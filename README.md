# native-say

Native text-to-speech for macOS and Windows.

## Install

```shell
npm i native-say
```

## Usage

Universal:

```javascript
import {say} from 'native-say';

await say('Hello, world!');
```

macOS only:

```javascript
import {say} from 'native-say/mac';

await say('Hello! My name is Cellos.', {voice: 'Cellos'});
```

Windows only:

```javascript
import {say} from 'native-say/windows';

await say('Hello! My name is David.', {voice: 'Microsoft David Desktop'});
```

Use the platform-specific entrypoints when your app targets one platform and you want bundlers to include only that backend.

## Platform Support

| Platform | Backend |
| --- | --- |
| macOS | Built-in `say` command |
| Windows | PowerShell with `System.Speech.Synthesis.SpeechSynthesizer` |

Other platforms are not supported.

## API

### say(text, options?)

#### text

Type: `string`

The content to be converted to audible speech.

#### options

Type: `SayOptions`

```typescript
type SayOptions = {
	voice?: string;
	rate?: number;
	audioDevice?: string;
	quality?: number;
	inputFile?: string;
	outputFile?: string;
	networkSend?: string;
	channels?: number;
	volume?: number;
	skipRunningCheck?: boolean;
};
```

Common options:

- `voice`
- `rate`
- `outputFile`
- `skipRunningCheck`

macOS-only options:

- `audioDevice`
- `quality`
- `inputFile`
- `networkSend`
- `channels`

Windows-only options:

- `volume`

The `native-say/mac` entrypoint exports macOS-specific `SayOptions`, `Voice`, and `SayProcess` type aliases. The `native-say/windows` entrypoint exports the Windows-specific aliases.

On Windows, `rate` maps to the SpeechSynthesizer range of `-10` to `10`, `volume` maps to `0` to `100`, and `outputFile` writes a WAV file.

On macOS, options map to the built-in `say` command. See `man say` for the native option behavior.

### getAudioDevices()

Returns a `Promise<Device[]>`.

On macOS, this returns audio output devices from `say --audio-device ?`.

On Windows, SpeechSynthesizer uses the system default output device, so this returns a default-device placeholder.

### getDataFormats(fileFormat)

Returns a `Promise<DataFormat[]>`.

On macOS, this returns data formats from the built-in `say` command.

On Windows, SpeechSynthesizer writes WAV output with PCM audio data.

### getFileFormats()

Returns a `Promise<FileFormat[]>`.

On macOS, this returns writable file formats from the built-in `say` command.

On Windows, SpeechSynthesizer writes WAV output.

### getVoices()

Returns a `Promise<Voice[]>`.

macOS voices use this shape:

```typescript
type MacVoice = {
	name: string;
	languageCode: string;
	example: string;
};
```

Windows voices use this shape:

```typescript
type WindowsVoice = {
	name: string;
	culture: string;
	gender: string;
	age: string;
	description: string;
	enabled: boolean;
};
```

### checkIfSayIsRunning()

Returns a `Promise<SayProcess | undefined>`.

On macOS, this checks the active native `say` process.

On Windows, this checks the tracked PowerShell speech process first, then falls back to discovering compatible `native-say` PowerShell processes by their command-line marker.

### killRunningSay()

Kills the active speech process when one is running.

On Windows, this can also kill compatible `native-say` speech processes started by another module instance or Node.js process.

## License

MIT
