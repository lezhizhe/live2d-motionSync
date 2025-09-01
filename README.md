<!-- english docs -->

# live2d-motionsync

A live2d motionsync library

> 当前项目fork 自 [live2d-motionSync](https://github.com/GuanBin/live2d-motionSync)，感谢 liyao1520 的贡献。

因为个人项目需要，对原有项目进行了一些升级改造！

## 开发环境准备

### 安装依赖
```bash
pnpm install
```

### 构建项目
```bash
pnpm run build
```

### 打包

```bash
pnpm pack
```

## Install

```bash
pnpm add /path/live2d-motionsync.0.0.6.tgz
```

## Usage

audio

```ts
import { MotionSync } from "live2d-motionsync";
```

media stream

```ts
import { MotionSync } from "live2d-motionsync/stream";
```

Install `pixi-live2d-display`

```bash
npm install pixi-live2d-display pixi.js@6.5.10

```

```ts
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display";
import { MotionSync } from "live2d-motionsync";

// expose PIXI to window so that this plugin is able to
// reference window.PIXI.Ticker to automatically update Live2D models
window.PIXI = PIXI;

(async function () {
  const app = new PIXI.Application({
    view: document.getElementById("canvas"),
  });

  const model = await Live2DModel.from("kei_vowels_pro.model3.json");

  // init motionsync
  const motionSync = new MotionSync(model.internalModel);
  // load motionsync file
  motionSync.loadMotionSyncFromUrl("kei_vowels_pro.motionsync3.json");
  // if no motionsync3 file, load default motionsync3 config
  // motionSync.loadDefaultMotionSync();

  // ensure page interaction
  // play audio
  motionSync.play("/audio/test.wav").then(() => {
    console.log("play end");
  });
  // stop audio
  // motionSync.reset();

  app.stage.addChild(model);

  // transforms
  model.x = 100;
  model.y = 100;
  model.rotation = Math.PI;
  model.skew.x = Math.PI;
  model.scale.set(2, 2);
  model.anchor.set(0.5, 0.5);

  // interaction
  model.on("hit", (hitAreas) => {
    if (hitAreas.includes("body")) {
      model.motion("tap_body");
    }
  });
})();
```

## MotionSync API

### `constructor(internalModel: any)`

Initialize a new `MotionSync` instance.

- **Parameters:**

  - `internalModel`: The internal model object containing the core model and other necessary components.

- **Description:**
  - This constructor uses the provided `internalModel` to initialize the `MotionSync` class and start and initialize the `CubismMotionSync` framework.

### `async play(src: string | AudioBuffer): Promise<void>`

- **Return:**

  - `Promise<void>`: A Promise that resolves when the audio playback ends.

Play audio from specified source.

- **Parameters:**

  - `src`: The audio source, which can be a URL string or an `AudioBuffer` object.

- **Description:**

  - This method loads audio from the given source and starts playback. It returns a Promise that resolves when the audio playback ends.

### `reset()`

Reset the `MotionSync` instance to its initial state.

- **Description:**
  - This method stops any ongoing audio playback and resets the mouth state.


### `setVolume(volume: number)`

Set the volume of the `MotionSync`.

- **Parameters:**

  - `volume`: The volume of the `MotionSync`.

- **Description:**
  - This method sets the volume of the `MotionSync`. 1 is the maximum volume. 0 is the minimum volume means mute. It's work's by setting the gain of a GainNode value.

### `loadMotionSync(buffer: ArrayBuffer, samplesPerSec = SamplesPerSec)`

Load motion sync data from `ArrayBuffer`.

- **Parameters:**

  - `buffer`: The `ArrayBuffer` containing the motion sync data.
  - `samplesPerSec`: The sample rate of the audio data (default is 48000).

- **Description:**
  - This method uses the provided motion sync data to initialize the `CubismMotionSync` instance.

### `async loadDefaultMotionSync(samplesPerSec = SamplesPerSec)`

Load default motion sync data.

- **Parameters:**

  - `samplesPerSec`: The sample rate of the audio data (default is 48000).

- **Description:**
  - This method loads the default motion sync data from a predefined URL.

### `async loadMotionSyncFromUrl(url: string, samplesPerSec = SamplesPerSec)`

Load motion sync data from URL.

- **Parameters:**

  - `url`: The URL of the motion sync data.
  - `samplesPerSec`: The sample rate of the audio data (default is 48000).

- **Description:**

  - This method fetches the motion sync data from the specified URL and initializes the `CubismMotionSync` instance. If the fetch fails, it falls back to loading the default motion sync data.

## MotionSync Stream

```ts
import { MotionSync } from "live2d-motionsync/stream";

const motionSync = new MotionSync(model.internalModel);
motionSync.loadMotionSyncFromUrl("kei_vowels_pro.motionsync3.json");
const mediaStream = await navigator.mediaDevices.getUserMedia({
  audio: true,
});
motionSync.play(mediaStream);

function stop() {
  motionSync.reset();
  mediaStream.getTracks().forEach((track) => track.stop());
}

// stop()
```

- [pixi-live2d-display](https://github.com/pixijs/pixi-live2d-display)