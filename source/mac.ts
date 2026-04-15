import {
	checkIfSayIsRunning as backendCheckIfSayIsRunning,
	getAudioDevices as backendGetAudioDevices,
	getDataFormats as backendGetDataFormats,
	getFileFormats as backendGetFileFormats,
	getVoices as backendGetVoices,
	killRunningSay as backendKillRunningSay,
	say as backendSay,
} from './backends/macos.js';
import type {
	DataFormat, Device, FileFormat, MacSayOptions, MacSayProcess, MacVoice,
} from './types.js';

export const say = async (text: string, options: MacSayOptions = {}) => backendSay(text, options);

export const getAudioDevices = async (): Promise<Device[]> => backendGetAudioDevices();

export const getDataFormats = async (fileFormat: string): Promise<DataFormat[]> => backendGetDataFormats(fileFormat);

export const getFileFormats = async (): Promise<FileFormat[]> => backendGetFileFormats();

export const getVoices = async (): Promise<MacVoice[]> => backendGetVoices();

export const checkIfSayIsRunning = async (): Promise<MacSayProcess | undefined> => backendCheckIfSayIsRunning();

export const killRunningSay = async (): Promise<void> => backendKillRunningSay();

export type {
	DataFormat,
	Device,
	FileFormat,
	MacSayOptions,
	MacSayOptions as SayOptions,
	MacSayProcess,
	MacSayProcess as SayProcess,
	MacVoice,
	MacVoice as Voice,
} from './types.js';
