import Crunker from "crunker";
import { csmVector } from "@cubism/type/csmvector";
import {
  CubismMotionSync,
  MotionSyncOption,
} from "../motionsync/live2dcubismmotionsync";
import type { InternalModel } from "pixi-live2d-display";
import { getAudioContext, initAudioContext } from "./audio";
import fallbackMotionsync3 from "../assets/fallback.motionsync3.json?raw";
import { isObject, isString } from "lodash-es";
// 初始化音频上下文
initAudioContext();

const SamplesPerSec = 48000;

export class MotionSyncCore {
  protected audioBuffer: AudioBuffer | null = null;
  protected audioSource: AudioBufferSourceNode | null = null;
  protected previousSamplePosition: number = 0;
  protected audioElapsedTime: number = 0;
  protected audioContextPreviousTime: number = 0;
  protected _motionSync: CubismMotionSync | null = null;
  protected _internalModel: InternalModel;
  protected _model: any;
  protected _gainNode: GainNode | null = null;
  protected soundBuffer = new csmVector<number>();
  protected samplesPerSec: number;
  get audioContext() {
    return getAudioContext();
  }
  get gainNode() {
    return this._gainNode;
  }
  constructor(internalModel: InternalModel, samplesPerSec = SamplesPerSec) {
    this._internalModel = internalModel;
    this._model = internalModel.coreModel;
    this.samplesPerSec = samplesPerSec;
    CubismMotionSync.startUp(new MotionSyncOption());
    CubismMotionSync.initialize();
    this._gainNode = this.audioContext.createGain();
    this._gainNode.gain.value = 1;
  }

  protected async loadAudio(url: string, stopOtherAudio = true) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    if (stopOtherAudio) {
      this.stop();
    }
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.audioBuffer = audioBuffer;
  }

  public urlToAudioBuffer(url: string) {
    return new Promise<AudioBuffer>(async (resolve, reject) => {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      resolve(audioBuffer);
    });
  }
  protected async loadAudioBuffer(
    audioBuffer: AudioBuffer,
    stopOtherAudio = true
  ) {
    if (stopOtherAudio) {
      this.stop();
    }
    this.audioBuffer = audioBuffer;
  }

  protected resetMouthStatus() {
    try {
      if (!this._motionSync) return;
      const setting = this._motionSync.getData().getSetting(0);
      if (!setting) return;
      const cubismParameterList = setting.cubismParameterList;
      if (!cubismParameterList) return;
      const mouthIndex = cubismParameterList._ptr.map(
        (item) => item.parameterIndex
      );
      for (const index of mouthIndex) {
        this._model.setParameterValueByIndex(index, 0);
      }
    } catch (e) {
      console.error(e);
    }
  }
  protected stop() {
    this.resetMouthStatus();

    if (this.audioSource) {
      this.audioSource.stop();
      this.audioSource.disconnect();
      this.audioSource = null;
    }

    this.audioContextPreviousTime = 0;
    this.previousSamplePosition = 0;
    this.audioElapsedTime = 0;
    this.soundBuffer.clear();
    this.soundBuffer = new csmVector<number>();
  }

  protected updateMotionSync() {
    if (!this.audioBuffer || !this.audioSource) {
      return;
    }

    const currentAudioTime = this.audioContext.currentTime;
    if (currentAudioTime <= this.audioContextPreviousTime) {
      this.audioContextPreviousTime = currentAudioTime;
    }

    const audioDeltaTime = currentAudioTime - this.audioContextPreviousTime;
    this.audioElapsedTime += audioDeltaTime;

    const currentSamplePosition = Math.floor(
      this.audioElapsedTime * this.audioBuffer.sampleRate
    );

    if (this.previousSamplePosition <= this.audioBuffer.length) {
      const currentAudioSamples = this.audioBuffer
        .getChannelData(0)
        .slice(this.previousSamplePosition, currentSamplePosition);

      for (let index = 0; index < currentAudioSamples.length; index++) {
        this.soundBuffer.pushBack(currentAudioSamples[index]);
      }
      if (!this._motionSync) return;
      this._motionSync.setSoundBuffer(0, this.soundBuffer, 0);
      this._motionSync.updateParameters(this._model, audioDeltaTime);

      const lastTotalProcessedCount =
        this._motionSync.getLastTotalProcessedCount(0);
      this.removeProcessedData(lastTotalProcessedCount);

      this.audioContextPreviousTime = currentAudioTime;
      this.previousSamplePosition = currentSamplePosition;
    }
  }

  protected modelUpdateWithMotionSync() {
    const motionSync = this._motionSync;
    if (!motionSync) return;
    const internalModel = this._internalModel;
    const updateFn = internalModel.motionManager.update;
    internalModel.motionManager.update = ((...args: any[]) => {
      updateFn.apply(this._internalModel.motionManager, args as any);
      this.updateMotionSync();
    }) as any;
  }

  protected removeProcessedData(size: number) {
    const buffer = this.soundBuffer;
    if (size < buffer.getSize()) {
      if (!buffer?.begin() || buffer?._size <= size) {
        return buffer;
      }

      buffer._ptr.splice(0, size);
      buffer._size -= size;
      return buffer;
    }
  }
  protected validateMotionSync(json: Record<string, any>) {
    if (!isObject(json)) return false;
    if (!isObject(json.FileReferences)) return false;
    if (!("MotionSync" in json.FileReferences)) return false;
    if (!isString(json.FileReferences.MotionSync)) return false;
    return true;
  }
  // load motion sync from settings
  public async loadMotionSync() {
    const settings = this._internalModel.settings;
    const json = settings.json as Record<string, any>;
    let buffer: ArrayBuffer | null = null;
    if (!this.validateMotionSync(json)) {
      const blob = new Blob([fallbackMotionsync3], {
        type: "application/json",
      });
      buffer = await blob.arrayBuffer();
    } else {
      const url = settings.resolveURL(json.FileReferences.MotionSync);
      const response = await fetch(url);
      buffer = await response.arrayBuffer();
    }
    this._motionSync = CubismMotionSync.create(
      this._model,
      buffer,
      buffer.byteLength,
      this.samplesPerSec
    );
    this.modelUpdateWithMotionSync();
  }
}

export class MotionSync extends MotionSyncCore {
  private _timer: NodeJS.Timeout | null = null;
  protected audioQueue: (AudioBuffer | Promise<AudioBuffer>)[] = [];
  async play(src: string | AudioBuffer, stopOtherAudio = true) {
    return new Promise<void>(async (resolve, reject) => {
      if (typeof src === "string") {
        await this.loadAudio(src, stopOtherAudio);
      } else {
        await this.loadAudioBuffer(src, stopOtherAudio);
      }
      if (this.audioBuffer) {
        this.audioSource = this.audioContext.createBufferSource();
        this.audioSource.buffer = this.audioBuffer;
        if (this._gainNode) {
          this.audioSource.connect(this._gainNode).connect(this.audioContext.destination);
        } else {
          this.audioSource.connect(this.audioContext.destination);
        }
        this.audioSource.start(0);
        clearTimeout(this._timer);
        this.audioSource.onended = () => {
          resolve();
          // 延迟100ms后重置嘴巴状态
          this._timer = setTimeout(() => {
            this.resetMouthStatus();
          }, 100);
          this.audioSource?.disconnect();
          this.audioSource = null; // 释放，方便队列调度

          this.playNextSegment(); // 在这里调度下一个
        };
        this.audioContextPreviousTime = this.audioContext.currentTime;
      } else {
        reject(new Error("audioBuffer is null"));
      }
    });
  }
  public async appendPlay(src: AudioBuffer) {
    this.audioQueue.push(src);

    // 如果当前没有在播放，就开始播放队列
    if (!this.audioSource) {
      this.playNextSegment();
    }
  }
  public async playNextSegment() {
    if (this.audioQueue.length === 0) {
      return;
    }

    const src = await this.audioQueue.shift();

    if (!src) return;

    try {
      await this.play(src, false);
    } catch (err) {
      console.error("播放失败:", err);
      this.playNextSegment(); // 播放失败时尝试播放下一个
    }
  }
  public setVolume(volume: number) {
    if (this._gainNode) {
      this._gainNode.gain.value = volume;
    }
  }
  public stop() {
    super.stop();
    this.audioQueue = [];
  }
}
