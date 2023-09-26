/*
CPAL-1.0 License

The contents of this file are subject to the Common Public Attribution License
Version 1.0. (the "License") you may not use this file except in compliance
with the License. You may obtain a copy of the License at
https://github.com/EtherealEngine/etherealengine/blob/dev/LICENSE.
The License is based on the Mozilla Public License Version 1.1, but Sections 14
and 15 have been added to cover use of software over a computer network and 
provide for limited attribution for the Original Developer. In addition, 
Exhibit A has been modified to be consistent with Exhibit B.

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the
specific language governing rights and limitations under the License.

The Original Code is Ethereal Engine.

The Original Developer is the Initial Developer. The Initial Developer of the
Original Code is the Ethereal Engine team.

All portions of the code written by the Ethereal Engine team are Copyright © 2021-2023 
Ethereal Engine. All Rights Reserved.
*/

/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useHookstate } from '@hookstate/core'
import React, { useEffect, useLayoutEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

import { useResizableVideoCanvas } from '@etherealengine/client-core/src/hooks/useResizableVideoCanvas'
import { useScrubbableVideo } from '@etherealengine/client-core/src/hooks/useScrubbableVideo'

import { useMediaNetwork } from '@etherealengine/client-core/src/common/services/MediaInstanceConnectionService'
import { useLocationSpawnAvatarWithDespawn } from '@etherealengine/client-core/src/components/World/EngineHooks'
import { MediaStreamService, MediaStreamState } from '@etherealengine/client-core/src/transports/MediaStreams'
import {
  SocketWebRTCClientNetwork,
  toggleWebcamPaused
} from '@etherealengine/client-core/src/transports/SocketWebRTCClientFunctions'
import { useVideoFrameCallback } from '@etherealengine/common/src/utils/useVideoFrameCallback'
import { Engine } from '@etherealengine/engine/src/ecs/classes/Engine'
import {
  ECSRecordingActions,
  PlaybackState,
  RecordingState,
  activePlaybacks
} from '@etherealengine/engine/src/recording/ECSRecordingSystem'

import { useWorldNetwork } from '@etherealengine/client-core/src/common/services/LocationInstanceConnectionService'
import { CaptureClientSettingsState } from '@etherealengine/client-core/src/media/CaptureClientSettingsState'
import { ChannelService } from '@etherealengine/client-core/src/social/services/ChannelService'
import { useGet } from '@etherealengine/engine/src/common/functions/FeathersHooks'
import { throttle } from '@etherealengine/engine/src/common/functions/FunctionHelpers'
import {
  MotionCaptureFunctions,
  combinedCaptureResults,
  mocapDataChannelType,
  motionCaptureResults
} from '@etherealengine/engine/src/mocap/MotionCaptureSystem'
import { EngineRenderer } from '@etherealengine/engine/src/renderer/WebGLRendererSystem'
import { StaticResourceType } from '@etherealengine/engine/src/schemas/media/static-resource.schema'
import { RecordingID, recordingPath } from '@etherealengine/engine/src/schemas/recording/recording.schema'
import {
  defineState,
  dispatchAction,
  getMutableState,
  getState,
  syncStateWithLocalStorage
} from '@etherealengine/hyperflux'
import Drawer from '@etherealengine/ui/src/components/tailwind/Drawer'
import Header from '@etherealengine/ui/src/components/tailwind/Header'
import RecordingsList from '@etherealengine/ui/src/components/tailwind/RecordingList'
import Canvas from '@etherealengine/ui/src/primitives/tailwind/Canvas'
import Video from '@etherealengine/ui/src/primitives/tailwind/Video'

import {
  DrawingUtils,
  FilesetResolver,
  HandLandmarker,
  NormalizedLandmark,
  PoseLandmarker
} from '@mediapipe/tasks-vision'

import ReactSlider from 'react-slider'
import Toolbar from '../../components/tailwind/mocap/Toolbar'
/**
 * Start playback of a recording
 * - If we are streaming data, close the data producer
 */
export const startPlayback = async (recordingID: RecordingID, twin = true, fromServer = false) => {
  const network = Engine.instance.worldNetwork as SocketWebRTCClientNetwork
  // close the data producer if we are streaming data
  // const dataProducer = MediasoupDataProducerConsumerState.getProducerByDataChannel(
  //   network.id,
  //   mocapDataChannelType
  // ) as DataProducer
  // if (getState(PlaybackState).recordingID && dataProducer) {
  //   dispatchAction(
  //     MediaProducerActions.producerClosed({
  //       producerID: dataProducer.id,
  //       $network: network.id,
  //       $topic: network.topic
  //     })
  //   )
  // }
  // // Server playback
  // PlaybackState.startPlayback({
  //   recordingID,
  //   targetUser: twin ? undefined : Engine.instance.userID
  // })

  // Client Playback
  dispatchAction(
    ECSRecordingActions.startPlayback({
      recordingID,
      targetUser: Engine.instance.userID,
      autoplay: false
    })
  )
}

export const stopPlayback = () => {
  const recordingID = getState(PlaybackState).recordingID
  if (!recordingID) return
  dispatchAction(
    ECSRecordingActions.stopPlayback({
      recordingID
    })
  )
}

const sendResults = (results: combinedCaptureResults) => {
  const network = Engine.instance.worldNetwork as SocketWebRTCClientNetwork
  if (!network?.ready) return
  const data = MotionCaptureFunctions.sendResults(results)
  network.transport.bufferToAll(mocapDataChannelType, Engine.instance.peerID, data)
}

const useVideoStatus = () => {
  const videoStream = useHookstate(getMutableState(MediaStreamState).videoStream)
  const videoPaused = useHookstate(getMutableState(MediaStreamState).videoPaused)
  const videoActive = !!videoStream.value && !videoPaused.value
  const mediaNetworkState = useMediaNetwork()
  if (!mediaNetworkState?.connected?.value) return 'loading'
  if (!videoActive) return 'ready'
  return 'active'
}

export const CaptureState = defineState({
  name: 'CaptureState',
  initial: {
    detectingStatus: 'inactive' as 'inactive' | 'active' | 'loading' | 'ready'
  }
})

const CaptureMode = () => {
  const captureState = useHookstate(getMutableState(CaptureClientSettingsState))
  const captureSettings = captureState?.nested('settings')?.value
  const displaySettings = captureSettings.filter((s) => s?.name.toLowerCase() === 'display')[0]
  const trackingSettings = captureSettings.filter((s) => s?.name.toLowerCase() === 'tracking')[0]
  const debugSettings = captureSettings.filter((s) => s?.name.toLowerCase() === 'debug')[0]

  const recordingID = useHookstate(getMutableState(RecordingState).recordingID)
  const startedAt = useHookstate(getMutableState(RecordingState).startedAt)
  const active = useHookstate(getMutableState(RecordingState).active)

  // todo include a mechanism to confirm that the recording has started/stopped
  const onToggleRecording = () => {
    if (recordingID.value) {
      RecordingState.stopRecording({
        recordingID: recordingID.value
      })
    } else {
      RecordingState.requestRecording({
        user: { Avatar: true },
        peers: { [Engine.instance.peerID]: { Audio: true, Video: true, Mocap: true } }
      })
    }
  }

  const mediaNetworkState = useMediaNetwork()

  const detectingStatus = useHookstate(getMutableState(CaptureState).detectingStatus)
  const isDetecting = detectingStatus.value === 'active'

  const poseDetector = useHookstate(null as null | PoseLandmarker)
  const handDetector = useHookstate(null as null | HandLandmarker)
  const handLandmarksState = useHookstate(null as null | motionCaptureResults)
  const poseLandmarksState = useHookstate(null as null | motionCaptureResults)
  const visionDetector = useHookstate(null as null | any)

  const handLandmarksReady = useHookstate(false)
  const poseLandmarksReady = useHookstate(false)

  const processingFrame = useHookstate(false)

  const videoStatus = useVideoStatus()

  const { videoRef, canvasRef, canvasCtxRef, resizeCanvas } = useResizableVideoCanvas()

  const videoStream = useHookstate(getMutableState(MediaStreamState).videoStream)

  useEffect(() => {
    if (!visionDetector.value)
      FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.6/wasm').then(
        (vision) => {
          visionDetector.set(vision)
        }
      )
  }, [])

  useEffect(() => {
    if (!visionDetector.value) return
    if (!handDetector.value) {
      HandLandmarker.createFromOptions(visionDetector.value, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 2
      }).then((hand) => {
        handDetector.set(hand)
        handLandmarksReady.set(true)
      })
    }
    if (!poseDetector.value) {
      PoseLandmarker.createFromOptions(visionDetector.value, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1
      }).then((pose) => {
        poseDetector.set(pose)
        poseLandmarksReady.set(true)
      })
    }
  }, [visionDetector])

  //Comenting this out until selfie mode is added to hands options
  /*
  useEffect(() => {
    const factor = displaySettings.flipVideo === true ? '-1' : '1'
    videoRef.current!.style.transform = `scaleX(${factor})`
  }, [displaySettings.flipVideo])
  */

  useLayoutEffect(() => {
    canvasCtxRef.current = canvasRef.current!.getContext('2d')!
    videoRef.current!.srcObject = videoStream.value
    resizeCanvas()
  }, [videoStream])

  const throttledSend = throttle(sendResults, 1)

  useVideoFrameCallback(videoRef.current, (videoTime, metadata) => {
    if (!poseDetector.value || processingFrame.value || detectingStatus.value !== 'active') return

    const poseResults = poseDetector.value.detectForVideo(videoRef.current!, videoRef.current?.currentTime!)
    poseLandmarksState.set({ worldLandmarks: poseResults.worldLandmarks, landmarks: poseResults.landmarks })

    if (!handDetector.value) return
    const handResults = handDetector.value.detectForVideo(videoRef.current!, videoRef.current?.currentTime!)
    handLandmarksState.set({ worldLandmarks: handResults.worldLandmarks, landmarks: handResults.landmarks })
  })

  useEffect(() => {
    if (
      !handDetector.value ||
      !isDetecting ||
      !displaySettings.show2dSkeleton ||
      !canvasCtxRef.current ||
      !canvasRef.current
    )
      return

    canvasCtxRef.current.save()
    canvasCtxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    canvasCtxRef.current.globalCompositeOperation = 'source-over'

    const drawingUtils = new DrawingUtils(canvasCtxRef.current)

    if (handLandmarksState.value)
      drawHandsToCanvas(handLandmarksState.value.landmarks, canvasCtxRef, canvasRef, drawingUtils)

    if (poseLandmarksState.value)
      drawPoseToCanvas(poseLandmarksState.value.landmarks, canvasCtxRef, canvasRef, drawingUtils)

    canvasCtxRef.current.restore()
  }, [isDetecting, handLandmarksState, poseLandmarksState])

  useEffect(() => {
    if (!isDetecting) return

    if (!poseDetector.value) {
      return
    }

    return () => {
      // detectingStatus.set('inactive')
      // if (poseDetector.value) {
      //   poseDetector.value.close()
      // }
      // poseDetector.set(null)

      if (canvasCtxRef.current && canvasRef.current) {
        canvasCtxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
  }, [poseDetector, isDetecting])

  useEffect(() => {
    if (!poseLandmarksState.value || !handLandmarksState.value) return
    poseLandmarksReady.set(false)
    handLandmarksReady.set(false)
    //send combined data here
    sendResults({ pose: poseLandmarksState.value, hands: handLandmarksState.value })
  }, [poseLandmarksReady, handLandmarksReady])

  const getRecordingStatus = () => {
    if (!active.value) return 'ready'
    if (startedAt.value) return 'active'
    return 'starting'
  }
  const recordingStatus = getRecordingStatus()

  return (
    <div className="w-full container mx-auto pointer-events-auto max-w-[1024px]">
      <div className="w-full h-auto px-2">
        <div className="w-full h-auto relative aspect-video overflow-hidden">
          <div className="absolute w-full h-full top-0 left-0 flex items-center bg-black">
            <Video
              ref={videoRef}
              className={twMerge('w-full h-auto opacity-100', !displaySettings?.showVideo && 'opacity-0')}
            />
          </div>
          <div
            className="object-contain absolute top-0 left-0 z-1 min-w-full h-auto"
            style={{ objectFit: 'contain', top: '0px' }}
          >
            <Canvas ref={canvasRef} />
          </div>
          <button
            onClick={() => {
              if (mediaNetworkState?.connected?.value) toggleWebcamPaused()
            }}
            className="absolute btn btn-ghost bg-none h-full w-full container mx-auto m-0 p-0 top-0 left-0 z-2"
          >
            {videoStatus === 'ready' && <h1>Enable Camera</h1>}
            {videoStatus === 'loading' && <h1>Loading...</h1>}
          </button>
        </div>
      </div>
      <div className="w-full h-auto relative aspect-video overflow-hidden">
        <div className="w-full container mx-auto">
          <Toolbar
            className="w-full"
            videoStatus={videoStatus}
            detectingStatus={detectingStatus.value}
            onToggleRecording={onToggleRecording}
            toggleWebcam={toggleWebcamPaused}
            toggleDetecting={() => {
              detectingStatus.set(detectingStatus.value === 'active' ? 'inactive' : 'active')
            }}
            isRecording={!!recordingID.value}
            recordingStatus={recordingStatus}
            cycleCamera={MediaStreamService.cycleCamera}
          />
        </div>
      </div>
    </div>
  )
}

const drawHandsToCanvas = (
  handLandmarks: NormalizedLandmark[][],
  canvasCtxRef: React.MutableRefObject<CanvasRenderingContext2D | undefined>,
  canvasRef: React.RefObject<HTMLCanvasElement | undefined>,
  drawingUtils: DrawingUtils
) => {
  if (!canvasCtxRef.current || !canvasRef.current) return

  if (handLandmarks && canvasCtxRef.current) {
    for (let i = 0; i < handLandmarks.length; i++) {
      //use tasks-vision utils import for draw connectors
      drawingUtils.drawConnectors(handLandmarks[i], HandLandmarker.HAND_CONNECTIONS, {
        color: '#fff',
        lineWidth: 2
      })
      drawingUtils.drawLandmarks(handLandmarks[i], { color: '#fff', lineWidth: 3 })
    }
  }
}

const drawPoseToCanvas = (
  poseLandmarks: NormalizedLandmark[][],
  canvasCtxRef: React.MutableRefObject<CanvasRenderingContext2D | undefined>,
  canvasRef: React.RefObject<HTMLCanvasElement | undefined>,
  drawingUtils: DrawingUtils
) => {
  if (!canvasCtxRef.current || !canvasRef.current) return

  if (poseLandmarks && canvasCtxRef.current) {
    for (let i = 0; i < poseLandmarks.length; i++) {
      //use tasks-vision utils import for draw connectors
      drawingUtils.drawConnectors(poseLandmarks[i], HandLandmarker.HAND_CONNECTIONS, {
        color: '#fff',
        lineWidth: 2
      })
      drawingUtils.drawLandmarks(poseLandmarks[i], { color: '#fff', lineWidth: 3 })
    }
  }
}

const VideoPlayback = (props: {
  startTime: number
  video: StaticResourceType
  mocap: StaticResourceType | undefined
}) => {
  const { video } = props
  const videoSrc = video.url

  const { videoRef, canvasRef, canvasCtxRef, resizeCanvas } = useResizableVideoCanvas()

  useEffect(() => {
    if (!videoRef.current) return
    videoRef.current.style.transform = `scaleX(-1)`
    videoRef.current.addEventListener('loadedmetadata', () => {
      resizeCanvas()
      videoRef.current!.play()
      canvasCtxRef.current = canvasRef.current!.getContext('2d')!
    })
  }, [videoRef.current])

  const playing = useHookstate(getMutableState(PlaybackState).playing)
  const currentTimeSeconds = useHookstate(getMutableState(PlaybackState).currentTime)

  useEffect(() => {
    if (!videoRef.current) return
    if (playing.value) {
      videoRef.current.play()
    } else {
      videoRef.current.pause()
    }
  }, [playing])

  const { handlePositionChange } = useScrubbableVideo(videoRef)

  //TODO REFACTOR PLAYBACK SYSTEM TO USE NEW POSE/HANDS DETECTION
  /** When the current time changes, update the video's current time and render motion capture */
  useEffect(() => {
    if (!videoRef.current || typeof currentTimeSeconds.value !== 'number') return

    if (!playing.value) handlePositionChange(currentTimeSeconds.value)

    const data = activePlaybacks.get(getState(PlaybackState).recordingID!)?.dataChannelChunks?.get(mocapDataChannelType)

    if (data) {
      const currentTimeMS = currentTimeSeconds.value * 1000
      const frame = data.frames.find((frame) => frame.timecode > currentTimeMS)
      if (!frame) return
      //drawPoseToCanvas(frame.data.results.poseLandmarks, canvasCtxRef, canvasRef)
    }
  }, [currentTimeSeconds])

  return (
    <div className="aspect-[4/3] w-auto h-full">
      <div className="aspect-[4/3] top-0 left-0 items-center bg-black">
        <Video
          ref={videoRef}
          src={videoSrc}
          controls={false}
          className={twMerge('aspect-[4/3] w-full h-auto opacity-100')}
        />
      </div>
      <div className="aspect-[4/3] absolute top-0 left-0 z-1 w-auto h-auto pointer-events-none">
        <Canvas ref={canvasRef} />
      </div>
    </div>
  )
}

const EngineCanvas = () => {
  const ref = useRef(null as null | HTMLDivElement)

  useEffect(() => {
    if (!ref?.current) return

    const canvas = EngineRenderer.instance.renderer.domElement
    ref.current.appendChild(canvas)

    const parent = canvas.parentElement!

    EngineRenderer.instance.needsResize = true

    // return () => {
    //   const canvas = document.getElementById('engine-renderer-canvas')!
    //   parent.removeChild(canvas)
    // }
  }, [ref])

  return (
    <div className="relative w-auto h-full aspect-[2/3]">
      <div ref={ref} className="w-full h-full" />
    </div>
  )
}

export const PlaybackControls = (props: { durationSeconds: number }) => {
  const currentTime = useHookstate(getMutableState(PlaybackState).currentTime)
  const playing = useHookstate(getMutableState(PlaybackState).playing)

  const setCurrentTime = (time) => {
    playing.set(false)
    currentTime.set(time)
  }

  const { durationSeconds } = props
  return (
    <div className="w-full h-full flex flex-row">
      <div className="relative aspect-video overflow-hidden">
        <button
          className="w-auto h-4 btn btn-ghost container z-2"
          onClick={() => {
            playing.set(!playing.value)
          }}
        >
          {playing.value ? 'Pause' : 'Play'}
        </button>
      </div>
      <ReactSlider
        className="w-full h-4 my-2 bg-gray-300 rounded-lg cursor-pointer"
        min={0}
        value={playing.value ? currentTime.value : undefined}
        max={durationSeconds}
        step={1 / 60} // todo store recording framerate in recording
        onChange={setCurrentTime}
        renderThumb={(props, state) => {
          return (
            <div
              {...props}
              className="w-8 h-4 bg-white rounded-full shadow-md text-center font=[lato] font-bold text-sm"
            >
              {Math.round(state.valueNow)}
            </div>
          )
        }}
      />
    </div>
  )
}

const PlaybackMode = () => {
  const recordingID = useHookstate(getMutableState(PlaybackState).recordingID)

  const recording = useGet(recordingPath, recordingID.value!)

  useEffect(() => {
    recording.refetch()
  }, [])

  const ActiveRecording = () => {
    const data = recording.data!
    const startTime = new Date(data.createdAt).getTime()
    const endTime = new Date(data.updatedAt).getTime()
    const durationSeconds = (endTime - startTime) / 1000

    useLocationSpawnAvatarWithDespawn()

    // get all video resources, paired with motion capture data if it exists
    const videoPlaybackPairs = data.resources.reduce(
      (acc, r) => {
        if (r.mimeType.includes('video')) {
          acc.push({
            video: r,
            mocap: data.resources.find((r) => r.key.includes(mocapDataChannelType))
          })
        }
        return acc
      },
      [] as { video: StaticResourceType; mocap: StaticResourceType | undefined }[]
    )

    return (
      <>
        <div className="w-full h-auto relative aspect-video overflow-hidden flex-column items-center justify-center">
          <div className="flex flex-row w-full h-full max-w-full items-center justify-center">
            {videoPlaybackPairs.map((r) => (
              <VideoPlayback startTime={startTime} {...r} key={r.video.id} />
            ))}
            <EngineCanvas />
          </div>
        </div>
        <PlaybackControls durationSeconds={durationSeconds} />
      </>
    )
  }

  const NoRecording = () => {
    return (
      <div className="max-w-[1024px] w-auto container mx-auto relative aspect-video overflow-hidden flex items-center justify-center bg-black">
        <h1 className="text-2xl">No Recording Selected</h1>
      </div>
    )
  }

  return (
    <div className="w-full container mx-auto pointer-events-auto items-center justify-center content-center">
      <div className="w-full h-auto px-2">{recording.data ? <ActiveRecording /> : <NoRecording />}</div>
      <div className="max-w-[1024px] w-full container mx-auto flex">
        <div className="w-full h-auto relative m-2">
          <RecordingsList {...{ startPlayback, stopPlayback }} />
        </div>
      </div>
    </div>
  )
}

const CapturePageState = defineState({
  name: 'CapturePageState',
  initial: {
    mode: 'playback' as 'playback' | 'capture'
  },
  onCreate: () => {
    syncStateWithLocalStorage(CapturePageState, ['mode'])
  }
})

const CaptureDashboard = () => {
  const worldNetwork = useWorldNetwork()

  // media server connecion
  useEffect(() => {
    if (worldNetwork?.connected?.value) {
      ChannelService.getInstanceChannel()
    }
  }, [worldNetwork?.connected?.value])

  const mode = useHookstate(getMutableState(CapturePageState).mode)

  return (
    <div className="max-w-[1024px] w-full container mx-auto overflow-hidden">
      <Drawer settings={<div></div>}>
        <Header mode={mode} />
        {mode.value === 'playback' ? <PlaybackMode /> : <CaptureMode />}
      </Drawer>
    </div>
  )
}

CaptureDashboard.displayName = 'CaptureDashboard'

CaptureDashboard.defaultProps = {}

export default CaptureDashboard
