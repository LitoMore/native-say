import process from 'node:process';
import type {
	DataFormat, Device, FileFormat, SayOptions, SayProcess, Voice,
} from '../types.js';

const createUnsupportedPlatformError = () => new Error(`native-say supports macOS and Windows only. Current platform: ${process.platform}`);

export const say = async (_text: string, _options: SayOptions = {}): Promise<void> => {
	throw createUnsupportedPlatformError();
};

export const getAudioDevices = async (): Promise<Device[]> => {
	throw createUnsupportedPlatformError();
};

export const getDataFormats = async (_fileFormat: string): Promise<DataFormat[]> => {
	throw createUnsupportedPlatformError();
};

export const getFileFormats = async (): Promise<FileFormat[]> => {
	throw createUnsupportedPlatformError();
};

export const getVoices = async (): Promise<Voice[]> => {
	throw createUnsupportedPlatformError();
};

export const checkIfSayIsRunning = async (): Promise<SayProcess | undefined> => {
	throw createUnsupportedPlatformError();
};

export const killRunningSay = async (): Promise<void> => {
	throw createUnsupportedPlatformError();
};
