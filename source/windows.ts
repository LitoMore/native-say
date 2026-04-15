import {
	checkIfSayIsRunning as backendCheckIfSayIsRunning,
	getAudioDevices as backendGetAudioDevices,
	getDataFormats as backendGetDataFormats,
	getFileFormats as backendGetFileFormats,
	getVoices as backendGetVoices,
	killRunningSay as backendKillRunningSay,
	say as backendSay,
} from './backends/windows.js';
import type {
	DataFormat, Device, FileFormat, WindowsSayOptions, WindowsSayProcess, WindowsVoice,
} from './types.js';

export const say = async (text: string, options: WindowsSayOptions = {}) => backendSay(text, options);

export const getAudioDevices = async (): Promise<Device[]> => backendGetAudioDevices();

export const getDataFormats = async (fileFormat: string): Promise<DataFormat[]> => backendGetDataFormats(fileFormat);

export const getFileFormats = async (): Promise<FileFormat[]> => backendGetFileFormats();

export const getVoices = async (): Promise<WindowsVoice[]> => backendGetVoices();

export const checkIfSayIsRunning = async (): Promise<WindowsSayProcess | undefined> => backendCheckIfSayIsRunning();

export const killRunningSay = async (): Promise<void> => backendKillRunningSay();

export type {
	DataFormat,
	Device,
	FileFormat,
	WindowsSayOptions,
	WindowsSayOptions as SayOptions,
	WindowsSayProcess,
	WindowsSayProcess as SayProcess,
	WindowsVoice,
	WindowsVoice as Voice,
} from './types.js';
