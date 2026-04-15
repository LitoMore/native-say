import {resolve} from 'node:path';
import process from 'node:process';
import {execa} from 'execa';
import fkill from 'fkill';
import {type DefaultTask, tasklist} from 'tasklist';
import type {
	DataFormat, Device, FileFormat, SayOptions, WindowsSayProcess, WindowsVoice,
} from '../types.js';

const powershellCommand = 'powershell.exe';
const powershellArguments = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command'];
const winSayMarker = 'NATIVE_SAY_TTS_PROCESS';
const markerLookupEnvironmentVariable = 'NATIVE_SAY_LOOKUP_MARKER';
const killSignals = new Set(['SIGKILL', 'SIGTERM']);

let runningPowerShellPid: number | undefined;

const escapePowerShellString = (value: string) => `'${value.replaceAll('\'', '\'\'')}'`;

export const runPowerShell = async (
	command: string,
	options: {
		track?: boolean;
	} = {},
) => {
	const subprocess = execa(powershellCommand, [...powershellArguments, options.track ? `# ${winSayMarker}\n${command}` : command], {
		env: {
			...process.env,
			...(options.track ? {[winSayMarker]: '1'} : {}),
		},
		reject: false,
	});

	if (options.track) {
		runningPowerShellPid = subprocess.pid;
	}

	try {
		const result = await subprocess;
		if (result.exitCode === 0 || (result.signal && killSignals.has(result.signal))) {
			return {
				stdout: result.stdout,
				stderr: result.stderr,
			};
		}

		throw new Error(result.stderr || `${powershellCommand} exited with code ${result.exitCode ?? 'unknown'}`);
	} finally {
		if (options.track && runningPowerShellPid === subprocess.pid) {
			runningPowerShellPid = undefined;
		}
	}
};

export const createSpeechSynthesizerScript = (script: string) => `
Add-Type -AssemblyName System.Speech
$synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
${script}
} finally {
	$synthesizer.Dispose()
}
`;

export async function say(text: string, options: SayOptions = {}) {
	if (!options.skipRunningCheck) {
		await killRunningSay();
	}

	const {voice, rate, volume, outputFile} = options;
	const script = createSpeechSynthesizerScript(`
	${voice ? `$synthesizer.SelectVoice(${escapePowerShellString(voice)})` : ''}
	${rate === undefined ? '' : `$synthesizer.Rate = ${rate}`}
	${volume === undefined ? '' : `$synthesizer.Volume = ${volume}`}
	${outputFile ? `$synthesizer.SetOutputToWaveFile(${escapePowerShellString(resolve(outputFile))})` : '$synthesizer.SetOutputToDefaultAudioDevice()'}
	$synthesizer.Speak(${escapePowerShellString(text)})
`);

	await runPowerShell(script, {track: true});
}

export const getVoices = async () => {
	const {stdout} = await runPowerShell(createSpeechSynthesizerScript(`
	$synthesizer.GetInstalledVoices() | ForEach-Object {
		$voice = $_.VoiceInfo
		[PSCustomObject]@{
			name = $voice.Name
			culture = $voice.Culture.Name
			gender = $voice.Gender.ToString()
			age = $voice.Age.ToString()
			description = $voice.Description
			enabled = $_.Enabled
		}
	} | ConvertTo-Json -Compress
`));

	if (!stdout.trim()) {
		return [];
	}

	const voices: unknown = JSON.parse(stdout);
	if (Array.isArray(voices)) {
		return voices.filter(voice => isVoice(voice));
	}

	return isVoice(voices) ? [voices] : [];
};

export const getAudioDevices = async (): Promise<Device[]> => [
	{
		id: 'default',
		name: 'Default audio device',
	},
];

export const getDataFormats = async (_fileFormat: string): Promise<DataFormat[]> => [
	{
		format: 'pcm',
		description: 'Pulse-code modulation',
	},
];

export const getFileFormats = async (): Promise<FileFormat[]> => [
	{
		format: 'wav',
		description: 'Waveform Audio File Format',
		extensions: ['.wav'],
		accFormats: ['pcm'],
	},
];

export const checkIfSayIsRunning = async (): Promise<WindowsSayProcess | undefined> => {
	const [sayProcess] = await getRunningSayProcesses();
	return sayProcess;
};

export const killRunningSay = async () => {
	const sayProcesses = await getRunningSayProcesses();
	await Promise.all(sayProcesses.map(async sayProcess => fkill(sayProcess.pid, {force: true, silent: true})));
};

const getRunningSayProcesses = async (): Promise<WindowsSayProcess[]> => {
	const processMap = new Map<number, WindowsSayProcess>();
	const trackedProcess = await getTrackedPowerShellProcess();
	if (trackedProcess) {
		processMap.set(trackedProcess.pid, trackedProcess);
	}

	for (const sayProcess of await getMarkedPowerShellProcesses()) {
		processMap.set(sayProcess.pid, sayProcess);
	}

	return [...processMap.values()];
};

const getTrackedPowerShellProcess = async (): Promise<WindowsSayProcess | undefined> => {
	if (runningPowerShellPid === undefined) {
		return undefined;
	}

	const processList = await tasklist({
		filter: [
			`PID eq ${runningPowerShellPid}`,
			`IMAGENAME eq ${powershellCommand}`,
		],
	});
	const found = processList.find((task): task is DefaultTask => task.pid === runningPowerShellPid && task.imageName.toLowerCase() === powershellCommand);
	if (!found) {
		return undefined;
	}

	return {
		platform: 'win32',
		pid: found.pid,
		name: found.imageName,
		command: powershellCommand,
		raw: found,
	};
};

const getMarkedPowerShellProcesses = async (): Promise<WindowsSayProcess[]> => {
	const result = await execa(powershellCommand, [
		...powershellArguments,
		`
$marker = $env:${markerLookupEnvironmentVariable}
Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" | Where-Object {
	$_.ProcessId -ne $PID -and
	$_.CommandLine -like "*$marker*"
} | ForEach-Object {
	[PSCustomObject]@{
		pid = [int]$_.ProcessId
		name = $_.Name
		command = $_.CommandLine
	}
} | ConvertTo-Json -Compress
`,
	], {
		env: {
			...process.env,
			[markerLookupEnvironmentVariable]: winSayMarker,
		},
		reject: false,
	});

	if (result.exitCode !== 0) {
		throw new Error(result.stderr || `${powershellCommand} exited with code ${result.exitCode ?? 'unknown'}`);
	}

	if (!result.stdout.trim()) {
		return [];
	}

	const parsedProcesses: unknown = JSON.parse(result.stdout);
	const processes = Array.isArray(parsedProcesses) ? parsedProcesses : [parsedProcesses];
	return processes
		.filter(processInfo => isMarkedPowerShellProcess(processInfo))
		.map(processInfo => ({
			platform: 'win32',
			pid: processInfo.pid,
			name: processInfo.name,
			command: processInfo.command,
			raw: processInfo,
		}));
};

const isMarkedPowerShellProcess = (value: unknown): value is {
	pid: number;
	name: string;
	command: string;
} => {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const processInfo = value as Partial<Record<'command' | 'name' | 'pid', unknown>>;
	return typeof processInfo.pid === 'number'
		&& Number.isInteger(processInfo.pid)
		&& typeof processInfo.name === 'string'
		&& typeof processInfo.command === 'string';
};

const isVoice = (value: unknown): value is WindowsVoice => {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const voice = value as Partial<Record<keyof WindowsVoice, unknown>>;
	return typeof voice.name === 'string'
		&& typeof voice.culture === 'string'
		&& typeof voice.gender === 'string'
		&& typeof voice.age === 'string'
		&& typeof voice.description === 'string'
		&& typeof voice.enabled === 'boolean';
};
