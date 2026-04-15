import {basename} from 'node:path';
import {execa} from 'execa';
import fkill from 'fkill';
import type {
	DataFormat, Device, FileFormat, MacSayProcess, MacVoice, SayOptions,
} from '../types.js';

const sayCommand = 'say';
const audioDeviceLinePattern = /^(?<id>\d+) +(?<name>.+)$/v;
const dataFormatPattern = /^(?<format>[a-z]+ +(?<description>.+))$/v;
const fileFormatPattern = /^(?<format>[a-zA-Z\d]+) +(?<description>.+[^ ]) +\((?<extensions>(\.[a-z\d]+,*)+)\) +\[(?<accFormats>(([a-z\d]+,*)+))\]$/v;
const voiceLinePattern = /^(?<name>.+[^ ]) +(?<languageCode>[a-z]{2}_[A-Z\d]{2,}) +# (?<example>.+)$/v;
const killSignals = new Set(['SIGKILL', 'SIGTERM']);

let runningSayPid: number | undefined;

export const parseLine
	= <T>(
		pattern: RegExp,
		options?: {
			groupsParser?: (groups: Record<keyof T, string>) => T;
		},
	) =>
		(line: string) => {
			const match = pattern.exec(line.trim());
			if (match) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
				const groups = {...(match.groups as Record<keyof T, string>)};
				if (options?.groupsParser) {
					return options.groupsParser(groups);
				}

				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
				return groups as T;
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
			voice ? ['--voice', voice] : [],
			rate === undefined ? [] : ['--rate', rate.toString()],
			audioDevice ? ['--audio-device', audioDevice] : [],
			quality === undefined ? [] : ['--quality', quality.toString()],
			inputFile ? ['--input-file', inputFile] : [],
			outputFile ? ['--output-file', outputFile] : [],
			networkSend ? ['--network-send', networkSend] : [],
			channels === undefined ? [] : ['--channels', channels.toString()],
		].flat(),
		{
			reject: false,
		},
	);
	runningSayPid = subprocess.pid;

	try {
		const result = await subprocess;
		if (result.exitCode === 0 || (result.signal && killSignals.has(result.signal))) {
			return;
		}

		throw new Error(result.stderr || `${sayCommand} exited with code ${result.exitCode ?? 'unknown'}`);
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
	if (exitCode !== 0 || !stdout.trim()) {
		return undefined;
	}

	const pid = Number(stdout.trim().split('\n')[0]);
	if (!Number.isInteger(pid)) {
		return undefined;
	}

	return getSayProcessByPid(pid);
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
	if (exitCode !== 0 || !command) {
		return undefined;
	}

	const name = basename(command.split(/\s+/v)[0] ?? sayCommand);
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
