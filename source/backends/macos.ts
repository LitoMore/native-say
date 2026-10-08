import {basename} from 'node:path';
import {execa} from 'execa';
import fkill from 'fkill';
import type {
	DataFormat,
	Device,
	FileFormat,
	MacSayProcess,
	MacVoice,
	SayOptions,
} from '../types.js';

const sayCommand = 'say';
const audioDeviceLinePattern = /^(?<id>\d+) +(?<name>[^ ].*)$/v;
const dataFormatPattern = /^(?<format>[a-z]+ +(?<description>[^ ].*))$/v;
const fileFormatPattern = /^(?<format>[\dA-Za-z]+) +(?<description>(?!\(\.)[^ ]+(?: +(?!\(\.)[^ ]+)*) +\((?<extensions>\.[\da-z]+(?:,\.[\da-z]+)*)\) +\[(?<accFormats>[\da-z]+(?:,[\da-z]+)*)\]$/v;
const voiceLinePattern = /^(?<name>.+[^ ]) +(?<languageCode>[a-z]{2}_[\dA-Z]{2,}) +# (?<example>.+)$/v;
const killSignals = new Set(['SIGKILL', 'SIGTERM']);

let runningSayPid: number | undefined;

const isNonEmptyString = (value: string | undefined): value is string => typeof value === 'string' && value !== '';

export const parseLine =
	<T>(
		pattern: RegExp,
		options?: {
			groupsParser?: (groups: Record<keyof T, string>) => T;
		},
	) =>
		(line: string) => {
			const match = pattern.exec(line.trim());
			if (match) {
				const groups = {...(match.groups as Record<keyof T, string>)};
				return options?.groupsParser ? options.groupsParser(groups) : (groups as T);
			}

			return undefined;
		};

export const getOptionValues = async <T>(
	options: string[],
	parser: (line: string) => T,
) => {
	const {stdout} = await execa(sayCommand, [...options, '?']);
	return [...new Set(stdout.split('\n'))]
		.map(line => parser(line))
		.filter((value): value is Exclude<T, undefined> => value !== undefined);
};

export const parseAudioDeviceLine = parseLine<Device>(audioDeviceLinePattern);
export const parseDataFormat = parseLine<DataFormat>(dataFormatPattern);
export const parseFileFormat = parseLine<FileFormat>(fileFormatPattern, {
	groupsParser: groups => ({
		...groups,
		extensions: groups.extensions.split(','),
		accFormats: groups.accFormats.split(','),
	}),
});
export const parseVoiceLine = parseLine<MacVoice>(voiceLinePattern);

export const getAudioDevices = async () => getOptionValues(['--audio-device'], parseAudioDeviceLine);
export const getDataFormats = async (fileFormat: string) => getOptionValues([`--file-format=${fileFormat}`, '--data-format'], parseDataFormat);
export const getFileFormats = async () => getOptionValues(['--file-format'], parseFileFormat);
export const getVoices = async () => getOptionValues(['--voice'], parseVoiceLine);

export async function say(text: string, options: SayOptions = {}) {
	if (!options.skipRunningCheck) {
		await killRunningSay();
	}

	const {voice, rate, audioDevice, quality, inputFile, outputFile, networkSend, channels} = options;
	const subprocess = execa(
		sayCommand,
		[
			text.startsWith('-') ? ` ${text}` : text,
			isNonEmptyString(voice) ? ['--voice', voice] : [],
			rate === undefined ? [] : ['--rate', rate.toString()],
			isNonEmptyString(audioDevice) ? ['--audio-device', audioDevice] : [],
			quality === undefined ? [] : ['--quality', quality.toString()],
			isNonEmptyString(inputFile) ? ['--input-file', inputFile] : [],
			isNonEmptyString(outputFile) ? ['--output-file', outputFile] : [],
			isNonEmptyString(networkSend) ? ['--network-send', networkSend] : [],
			channels === undefined ? [] : ['--channels', channels.toString()],
		].flat(),
		{
			reject: false,
		},
	);
	runningSayPid = subprocess.pid;

	try {
		const result = await subprocess;
		if (result.exitCode === 0 || (result.signal !== undefined && killSignals.has(result.signal))) {
			return;
		}

		throw new Error(result.stderr === '' ? `${sayCommand} exited with code ${result.exitCode ?? 'unknown'}` : result.stderr);
	} finally {
		if (runningSayPid === subprocess.pid) {
			runningSayPid = undefined;
		}
	}
}

export const checkIfSayIsRunning = async (): Promise<MacSayProcess | undefined> => {
	if (runningSayPid !== undefined) {
		const runningProcess = await getSayProcessByPid(runningSayPid);
		if (runningProcess) {
			return runningProcess;
		}
	}

	const {stdout, exitCode} = await execa('pgrep', ['-x', sayCommand], {
		reject: false,
	});
	if (exitCode !== 0 || stdout.trim() === '') {
		return undefined;
	}

	const pid = Number(stdout.trim().split('\n', 1)[0]);
	return Number.isSafeInteger(pid) ? getSayProcessByPid(pid) : undefined;
};

export const killRunningSay = async () => {
	const sayProcess = await checkIfSayIsRunning();
	if (sayProcess) {
		await fkill(sayProcess.pid, {force: true, silent: true});
	}
};

const getSayProcessByPid = async (pid: number): Promise<MacSayProcess | undefined> => {
	const {stdout, exitCode} = await execa('ps', ['-p', pid.toString(), '-o', 'command='], {
		reject: false,
	});
	const command = stdout.trim();
	if (exitCode !== 0 || command === '') {
		return undefined;
	}

	const name = basename(command.split(/\s+/v, 1)[0] ?? sayCommand);
	if (name !== sayCommand) {
		return undefined;
	}

	return {
		platform: 'darwin',
		pid,
		name,
		command,
	};
};
