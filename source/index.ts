import process from 'node:process';
import * as macos from './backends/macos.js';
import type {Backend} from './backends/types.js';
import * as unsupported from './backends/unsupported.js';
import * as windows from './backends/windows.js';
import type {
	DataFormat, Device, FileFormat, SayOptions, SayProcess, Voice,
} from './types.js';

const getBackend = (): Backend => {
	if (process.platform === 'darwin') {
		return macos;
	}

	if (process.platform === 'win32') {
		return windows;
	}

	return unsupported;
};

export const say = async (text: string, options: SayOptions = {}) => getBackend().say(text, options);

export const getAudioDevices = async (): Promise<Device[]> => getBackend().getAudioDevices();

export const getDataFormats = async (fileFormat: string): Promise<DataFormat[]> => getBackend().getDataFormats(fileFormat);

export const getFileFormats = async (): Promise<FileFormat[]> => getBackend().getFileFormats();

export const getVoices = async (): Promise<Voice[]> => getBackend().getVoices();

export const checkIfSayIsRunning = async (): Promise<SayProcess | undefined> => getBackend().checkIfSayIsRunning();

export const killRunningSay = async (): Promise<void> => getBackend().killRunningSay();

export type * from './types.js';
