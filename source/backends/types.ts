import type {
	DataFormat, Device, FileFormat, SayOptions, SayProcess, Voice,
} from '../types.js';

export type Backend = {
	say: (text: string, options?: SayOptions) => Promise<void>;
	getAudioDevices: () => Promise<Device[]>;
	getDataFormats: (fileFormat: string) => Promise<DataFormat[]>;
	getFileFormats: () => Promise<FileFormat[]>;
	getVoices: () => Promise<Voice[]>;
	checkIfSayIsRunning: () => Promise<SayProcess | undefined>;
	killRunningSay: () => Promise<void>;
};
