export type Platform = 'darwin' | 'win32';

export type MacSayOptions = {
	voice?: string;
	rate?: number;
	audioDevice?: string;
	quality?: number;
	inputFile?: string;
	outputFile?: string;
	networkSend?: string;
	channels?: number;
	skipRunningCheck?: boolean;
};

export type WindowsSayOptions = {
	voice?: string;
	rate?: number;
	volume?: number;
	outputFile?: string;
	skipRunningCheck?: boolean;
};

export type SayOptions = MacSayOptions & WindowsSayOptions;

export type MacVoice = {
	name: string;
	languageCode: string;
	example: string;
};

export type WindowsVoice = {
	name: string;
	culture: string;
	gender: string;
	age: string;
	description: string;
	enabled: boolean;
};

export type Voice = MacVoice | WindowsVoice;

export type Device = {
	id: string;
	name: string;
};

export type DataFormat = {
	format: string;
	description: string;
};

export type FileFormat = {
	format: string;
	description: string;
	extensions: string[];
	accFormats: string[];
};

type SayProcessBase = {
	pid: number;
	name: string;
	command?: string;
	raw?: unknown;
};

export type MacSayProcess = SayProcessBase & {
	platform: 'darwin';
};

export type WindowsSayProcess = SayProcessBase & {
	platform: 'win32';
};

export type SayProcess = MacSayProcess | WindowsSayProcess;
