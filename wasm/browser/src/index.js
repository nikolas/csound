require("google-closure-library/closure/goog/base.js");
import * as Comlink from "comlink/dist/esm/comlink.mjs";
import VanillaWorkerMainThread from "./mains/vanilla.main";
import unmuteIosAudio from "unmute-ios-audio/index.js";
import SharedArrayBufferMainThread from "./mains/sab.main";
import AudioWorkletMainThread from "./mains/worklet.main";
import ScriptProcessorNodeMainThread from "./mains/old-spn.main";
import ScriptProcessorNodeSingleThread from "./mains/spn.main";
import SingleThreadAudioWorkletMainThread from "./mains/worklet.singlethread.main";
// import wasmDataURI from "@csound/wasm-bin/lib/csound.dylib.wasm.z";
import { logIndex as log } from "./logger";
import {
  areWorkletsSupported,
  isSabSupported,
  isScriptProcessorNodeSupported,
  WebkitAudioContext,
} from "./utils";

const wasmDataURI = goog.require("binary.wasm");
const wasmTransformerDataURI = goog.require("transformer.wasm");
console.log(wasmDataURI, wasmTransformerDataURI);
/**
 * CsoundObj API.
 * @async
 * @export
 * @return {Promise.<CsoundObj|undefined>}
 * @suppress {misplacedTypeAnnotation}
 */
async function Csound({
  audioContext,
  inputChannelCount,
  outputChannelCount,
  autoConnect = true,
  withPlugins = [],
  useWorker = false,
  useSAB = true,
  useSPN = false,
} = {}) {
  unmuteIosAudio();

  const audioContextIsProvided =
    audioContext && WebkitAudioContext() && audioContext instanceof WebkitAudioContext();

  if (!audioContextIsProvided) {
    // default to creating an audio context for SingleThread
    audioContext = audioContext || new (WebkitAudioContext())({ latencyHint: "interactive" });
  }
  const workletSupport = areWorkletsSupported();
  const spnSupport = isScriptProcessorNodeSupported();

  // SingleThread implementations
  if (!useWorker) {
    if (workletSupport && !useSPN) {
      log("Single Thread AudioWorklet")();
      const instance = new SingleThreadAudioWorkletMainThread({
        audioContext,
        inputChannelCount: inputChannelCount || 2,
        outputChannelCount: outputChannelCount || 2,
      });
      // const instance = await createSingleThreadAudioWorkletAPI({audioContext, withPlugins});
      // return instance;
      return instance.initialize({ wasmDataURI, wasmTransformerDataURI, withPlugins, autoConnect });
    } else if (spnSupport) {
      log("Single Thread ScriptProcessorNode")();
      const instance = new ScriptProcessorNodeSingleThread({
        audioContext,
        inputChannelCount: inputChannelCount || 2,
        outputChannelCount: outputChannelCount || 2,
      });
      return await instance.initialize({
        wasmDataURI,
        wasmTransformerDataURI,
        withPlugins,
        autoConnect,
      });
    } else {
      console.error("No detectable WebAudioAPI in current environment");
      return;
    }
  }

  if (workletSupport) {
    // closure-compiler keepme
    log(`worklet support detected`)();
  } else if (spnSupport) {
    // closure-compiler keepme
    log(`scriptProcessorNode support detected`)();
  } else {
    console.error(`No WebAudio Support detected`);
  }

  let audioWorker;
  let csoundWasmApi;

  if (!useSPN && workletSupport) {
    audioWorker = new AudioWorkletMainThread({ audioContext, audioContextIsProvided, autoConnect });
  } else if (spnSupport) {
    audioWorker = new ScriptProcessorNodeMainThread({
      audioContext,
      audioContextIsProvided,
      autoConnect,
    });
  }

  if (!audioWorker) {
    console.error("No detectable WebAudioAPI in current environment");
    return;
  }

  const hasSABSupport = isSabSupported();

  if (!hasSABSupport) {
    log(`SharedArrayBuffers not found, falling back to Vanilla concurrency`)();
  } else {
    useSAB && log(`using SharedArrayBuffers`)();
  }

  const worker =
    hasSABSupport && workletSupport && useSAB
      ? new SharedArrayBufferMainThread({
          audioWorker,
          wasmDataURI,
          audioContext,
          audioContextIsProvided,
          inputChannelCount,
          outputChannelCount,
        })
      : new VanillaWorkerMainThread({
          audioWorker,
          wasmDataURI,
          wasmTransformerDataURI,
          audioContextIsProvided,
        });

  if (worker) {
    log(`starting Csound thread initialization via WebWorker`)();
    await worker.initialize({ withPlugins });
    csoundWasmApi = worker.api;
  } else {
    console.error("No detectable WebAssembly support in current environment");
    return;
  }

  return csoundWasmApi;
}
