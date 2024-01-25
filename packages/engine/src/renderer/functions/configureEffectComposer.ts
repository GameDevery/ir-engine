/*
CPAL-1.0 License

The contents of this file are subject to the Common Public Attribution License
Version 1.0. (the "License"); you may not use this file except in compliance
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

import {
  BlendFunction,
  DepthDownsamplingPass,
  DepthPass,
  EdgeDetectionMode,
  EffectComposer,
  EffectPass,
  NormalPass,
  OutlineEffect,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  TextureEffect
} from 'postprocessing'
import { VelocityDepthNormalPass } from 'realism-effects'
import { DepthTexture, NearestFilter, PerspectiveCamera, RGBAFormat, UnsignedIntType, WebGLRenderTarget } from 'three'

import { getState } from '@etherealengine/hyperflux'

import { SDFComponent } from '@etherealengine/engine/src/scene/components/SDFComponent'
import { ShaderPass } from 'postprocessing'
import { CameraComponent } from '../../camera/components/CameraComponent'
import { Engine } from '../../ecs/classes/Engine'
import { EngineState } from '../../ecs/classes/EngineState'
import { getComponent } from '../../ecs/functions/ComponentFunctions'
import { ObjectLayers } from '../../scene/constants/ObjectLayers'
import { EffectMap, EffectPropsSchema, Effects } from '../../scene/constants/PostProcessing'
import { HighlightState } from '../HighlightState'
import { RendererState } from '../RendererState'
import { EffectComposerWithSchema, EngineRenderer, PostProcessingSettingsState } from '../WebGLRendererSystem'
import { SDFShader } from '../effects/SDFShader'
import { changeRenderMode } from './changeRenderMode'

export const configureEffectComposer = (
  remove?: boolean,
  camera: PerspectiveCamera = getComponent(Engine.instance.cameraEntity, CameraComponent)
): void => {
  if (!EngineRenderer.instance) return
  if (!camera) return

  const scene = Engine.instance.scene

  EngineRenderer.instance.renderPass = null!
  EngineRenderer.instance.effectComposer.dispose()
  const composer = new EffectComposer(EngineRenderer.instance.renderer) as EffectComposerWithSchema
  EngineRenderer.instance.effectComposer = composer

  // we always want to have at least the render pass enabled
  const renderPass = new RenderPass(scene, camera)
  EngineRenderer.instance.effectComposer.addPass(renderPass)
  EngineRenderer.instance.renderPass = renderPass

  if (remove) {
    return
  }

  const renderSettings = getState(RendererState)
  renderSettings.usePostProcessing = true
  if (!renderSettings.usePostProcessing) return

  const effects: any[] = []

  const smaaEffect = new SMAAEffect({
    preset: SMAAPreset.HIGH,
    edgeDetectionMode: EdgeDetectionMode.COLOR
  })
  composer.SMAAEffect = smaaEffect

  const outlineEffect = new OutlineEffect(scene, camera, getState(HighlightState))
  outlineEffect.selectionLayer = ObjectLayers.HighlightEffect
  composer.HighlightEffect = outlineEffect

  const SmaaEffectPass = new EffectPass(camera, smaaEffect)
  const OutlineEffectPass = new EffectPass(camera, outlineEffect)
  composer.addPass(OutlineEffectPass) //outlines don't follow camera
  composer.addPass(SmaaEffectPass)

  const postprocessingSettings = getState(PostProcessingSettingsState)

  const postProcessingEffects = postprocessingSettings.effects as EffectPropsSchema

  const effectKeys = Object.keys(EffectMap)

  const normalPass = new NormalPass(scene, camera)

  const depthDownsamplingPass = new DepthDownsamplingPass({
    normalBuffer: normalPass.texture,
    resolutionScale: 0.5
  })

  const SDFSetting = getState(SDFComponent.SDFStateSettingsState)
  if (SDFSetting.enabled) {
    const depthRenderTarget = new WebGLRenderTarget(window.innerWidth, window.innerHeight)
    depthRenderTarget.texture.minFilter = NearestFilter
    depthRenderTarget.texture.magFilter = NearestFilter
    depthRenderTarget.texture.generateMipmaps = false
    depthRenderTarget.stencilBuffer = false
    depthRenderTarget.depthBuffer = true
    depthRenderTarget.depthTexture = new DepthTexture(window.innerWidth, window.innerHeight)
    depthRenderTarget.texture.format = RGBAFormat
    depthRenderTarget.depthTexture.type = UnsignedIntType

    const depthPass = new DepthPass(scene, camera, {
      renderTarget: depthRenderTarget
    })

    composer.addPass(depthPass)

    SDFShader.shader.uniforms.uDepth.value = depthRenderTarget.depthTexture
    const SDFPass = new ShaderPass(SDFShader.shader, 'inputBuffer')
    composer.addPass(SDFPass)
  }
  if (!postprocessingSettings.enabled) return
  const velocityDepthNormalPass = new VelocityDepthNormalPass(scene, camera)
  let useVelocityDepthNormalPass = false
  let useDepthDownsamplingPass = false

  for (const key of effectKeys) {
    const effect = postProcessingEffects[key]

    if (!effect || !effect.isActive) continue
    const EffectClass = EffectMap[key]

    if (!EffectClass) continue

    if (key === Effects.SSAOEffect) {
      const eff = new EffectClass(camera, normalPass.texture, {
        ...effect,
        normalDepthBuffer: depthDownsamplingPass.texture
      })
      useDepthDownsamplingPass = true
      composer[key] = eff
      effects.push(eff)
    } else if (key === Effects.SSREffect) {
      const eff = new EffectClass(scene, camera, velocityDepthNormalPass, effect)
      useVelocityDepthNormalPass = true
      composer[key] = eff
      effects.push(eff)
    } else if (key === Effects.DepthOfFieldEffect) {
      const eff = new EffectClass(camera, effect)
      composer[key] = eff
      effects.push(eff)
    } else if (key === Effects.SSGIEffect) {
      const eff = new EffectClass(scene, camera, velocityDepthNormalPass, effect)
      useVelocityDepthNormalPass = true
      composer[key] = eff
      effects.push(eff)
    } else if (key === Effects.TRAAEffect) {
      // todo support more than 1 texture
      const textureCount = 1
      const eff = new EffectClass(scene, camera, velocityDepthNormalPass, textureCount, effect)
      useVelocityDepthNormalPass = true
      composer[key] = eff
      effects.push(eff)
    } else if (key === Effects.MotionBlurEffect) {
      const eff = new EffectClass(velocityDepthNormalPass, effect)
      useVelocityDepthNormalPass = true
      composer[key] = eff
      effects.push(eff)
    } else {
      const eff = new EffectClass(effect)
      composer[key] = eff
      effects.push(eff)
    }
  }
  if (effects.length) {
    if (useVelocityDepthNormalPass) composer.addPass(velocityDepthNormalPass)

    if (useDepthDownsamplingPass) {
      composer.addPass(normalPass)
      composer.addPass(depthDownsamplingPass)
      const textureEffect = new TextureEffect({
        blendFunction: BlendFunction.SKIP,
        texture: depthDownsamplingPass.texture
      })
      effects.push(textureEffect)
    }

    composer.EffectPass = new EffectPass(camera, ...effects)
    composer.addPass(composer.EffectPass)
  }
  if (getState(EngineState).isEditor) changeRenderMode()
}
