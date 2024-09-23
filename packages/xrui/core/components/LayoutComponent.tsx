/*
CPAL-1.0 License

The contents of this file are subject to the Common Public Attribution License
Version 1.0. (the "License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at
https://github.com/ir-engine/ir-engine/blob/dev/LICENSE.
The License is based on the Mozilla Public License Version 1.1, but Sections 14
and 15 have been added to cover use of software over a computer network and 
provide for limited attribution for the Original Developer. In addition, 
Exhibit A has been modified to be consistent with Exhibit B.

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the
specific language governing rights and limitations under the License.

The Original Code is Infinite Reality Engine.

The Original Developer is the Initial Developer. The Initial Developer of the
Original Code is the Infinite Reality Engine team.

All portions of the code written by the Infinite Reality Engine team are Copyright © 2021-2023 
Infinite Reality Engine. All Rights Reserved.
*/

import {
  ECSState,
  defineComponent,
  getMutableComponent,
  setComponent,
  useComponent,
  useEntityContext,
  useOptionalComponent
} from '@ir-engine/ecs'
import { S } from '@ir-engine/ecs/src/schemas/JSONSchemas'
import { getState, useImmediateEffect } from '@ir-engine/hyperflux'
import { TransformComponent } from '@ir-engine/spatial'
import { CameraComponent } from '@ir-engine/spatial/src/camera/components/CameraComponent'
import { Vector3_One, Vector3_Zero } from '@ir-engine/spatial/src/common/constants/MathConstants'
import { RendererComponent } from '@ir-engine/spatial/src/renderer/WebGLRendererSystem'
import { BoundingBoxComponent } from '@ir-engine/spatial/src/transform/components/BoundingBoxComponents'
import { ComputedTransformComponent } from '@ir-engine/spatial/src/transform/components/ComputedTransformComponent'
import { ArrayCamera, Matrix4, Quaternion, Vector3 } from 'three'
import { Transition, TransitionData } from '../classes/Transition'

export enum SizeMode {
  proportional = 'proportional',
  literal = 'literal'
}

const _size = new Vector3()

export const LayoutComponent = defineComponent({
  name: 'LayoutComponent',

  schema: S.Object({
    position: S.Optional(S.Vec3()),
    positionTransition: Transition.defineVector3Transition(),
    effectivePosition: S.Vec3(),

    positionOrigin: S.Optional(S.Vec3()),
    positionOriginTransition: Transition.defineVector3Transition(),
    effectivePositionOrigin: S.Vec3(),

    alignmentOrigin: S.Optional(S.Vec3()),
    alignmentTransition: Transition.defineVector3Transition(),
    effectiveAlignmentOrigin: S.Vec3(),

    rotation: S.Optional(S.Quaternion()),
    rotationTransition: Transition.defineQuaternionTransition(),
    effectiveRotation: S.Quaternion(),

    rotationOrigin: S.Optional(S.Vec3()),
    rotationOriginTransition: Transition.defineVector3Transition(),
    effectiveRotationOrigin: S.Vec3(),

    size: S.Optional(S.Vec3()),
    sizeTransition: Transition.defineVector3Transition(),
    effectiveSize: S.Vec3(),

    sizeMode: S.Optional(
      S.Object({
        x: S.Enum(SizeMode),
        y: S.Enum(SizeMode),
        z: S.Enum(SizeMode)
      })
    ),

    effectiveSizeMode: S.Object({
      x: S.Enum(SizeMode, SizeMode.literal),
      y: S.Enum(SizeMode, SizeMode.literal),
      z: S.Enum(SizeMode, SizeMode.literal)
    }),

    defaults: S.Object({
      position: S.Vec3(),
      positionOrigin: S.Vec3(),
      alignmentOrigin: S.Vec3(),
      rotation: S.Quaternion(),
      rotationOrigin: S.Vec3(),
      size: S.Vec3(),
      sizeMode: S.Object({
        x: S.Enum(SizeMode, SizeMode.literal),
        y: S.Enum(SizeMode, SizeMode.literal),
        z: S.Enum(SizeMode, SizeMode.literal)
      })
    }),

    anchorEntity: S.Entity(),
    contentEntity: S.Entity()
  }),

  reactor: () => {
    const entity = useEntityContext()
    const layout = useComponent(entity, LayoutComponent)

    // This layout might be anchored to another layout, or an object with a bounding box, or a camera.
    const anchorEntity = layout.anchorEntity.value
    const anchorLayout = useOptionalComponent(anchorEntity, LayoutComponent)
    const anchorCamera = useOptionalComponent(anchorEntity, CameraComponent)
    const anchorRenderer = useOptionalComponent(anchorEntity, RendererComponent)
    const anchorBounds = useOptionalComponent(anchorEntity, BoundingBoxComponent)

    // Compute effective properties
    useImmediateEffect(() => {
      if (!layout) return
      const defaults = layout.defaults.value
      layout.effectivePosition.value.copy(new Vector3().copy(layout.position.value ?? defaults.position))
      layout.effectivePositionOrigin.set(new Vector3().copy(layout.positionOrigin.value ?? defaults.positionOrigin))
      layout.effectiveAlignmentOrigin.set(new Vector3().copy(layout.alignmentOrigin.value ?? defaults.alignmentOrigin))
      layout.effectiveRotation.set(new Quaternion().copy(layout.rotation.value ?? defaults.rotation))
      layout.effectiveRotationOrigin.set(new Vector3().copy(layout.rotationOrigin.value ?? defaults.rotationOrigin))
      layout.effectiveSizeMode.set({ ...(layout.sizeMode.value ?? defaults.sizeMode) })
      layout.effectiveSize.set(new Vector3().copy(layout.size.value ?? defaults.size))
    }, [
      layout.position,
      layout.size,
      layout.sizeMode,
      layout.positionOrigin,
      layout.alignmentOrigin,
      layout.rotation,
      layout.rotationOrigin,
      layout.defaults
    ])

    // apply new target to transitions when effective properties change
    useImmediateEffect(() => {
      if (!layout) return
      const simulationTime = getState(ECSState).simulationTime
      Transition.applyNewTarget(layout.effectivePosition.value, simulationTime, layout.positionTransition)
      Transition.applyNewTarget(layout.effectivePositionOrigin.value, simulationTime, layout.positionOriginTransition)
      Transition.applyNewTarget(layout.effectiveAlignmentOrigin.value, simulationTime, layout.alignmentTransition)
      Transition.applyNewTarget(layout.effectiveRotation.value, simulationTime, layout.rotationTransition)
      Transition.applyNewTarget(layout.effectiveRotationOrigin.value, simulationTime, layout.rotationOriginTransition)
      Transition.applyNewTarget(layout.effectiveSize, simulationTime, layout.sizeTransition)
    }, [
      layout.positionTransition,
      layout.positionOriginTransition,
      layout.alignmentTransition,
      layout.rotationTransition,
      layout.rotationOriginTransition
    ])

    // Reusable objects for calculations
    const finalPosition = new Vector3()
    const rotationOriginOffset = new Vector3()
    const matrix = new Matrix4()
    const tempMatrix = new Matrix4()
    const finalRotation = new Quaternion()
    const finalScale = new Vector3()

    useImmediateEffect(() => {
      setComponent(entity, ComputedTransformComponent, {
        referenceEntities: [anchorEntity],

        computeFunction: () => {
          const frameTime = getState(ECSState).frameTime

          // Update transitions
          Transition.computeCurrentValue(frameTime, layout.positionTransition.value as TransitionData<Vector3>)
          Transition.computeCurrentValue(frameTime, layout.positionOriginTransition.value as TransitionData<Vector3>)
          Transition.computeCurrentValue(frameTime, layout.alignmentTransition.value as TransitionData<Vector3>)
          Transition.computeCurrentValue(frameTime, layout.rotationTransition.value as TransitionData<Quaternion>)
          Transition.computeCurrentValue(frameTime, layout.rotationOriginTransition.value as TransitionData<Vector3>)

          // Get current values
          const position = layout.positionTransition.value.current
          const positionOrigin = layout.positionOriginTransition.value.current
          const alignmentOrigin = layout.alignmentTransition.value.current
          const rotation = layout.rotationTransition.value.current
          const rotationOrigin = layout.rotationOriginTransition.value.current
          const size = layout.effectiveSize.value

          // Compute the final position
          const finalPosition = new Vector3()
          let anchorSize = Vector3_Zero

          if (anchorCamera?.value && anchorRenderer?.canvas.value) {
            // Handle camera anchor
            const canvas = anchorRenderer.canvas.value
            const rect = canvas.getBoundingClientRect()

            // Screen-space position in pixels
            const screenPosition = new Vector3(
              position.x + positionOrigin.x * rect.width - alignmentOrigin.x * size.x,
              position.y + positionOrigin.y * rect.height - alignmentOrigin.y * size.y,
              0 // We'll set the depth separately
            )

            // Convert screen position to NDC (Normalized Device Coordinates)
            const ndc = new Vector3(
              (screenPosition.x / rect.width) * 2 - 1,
              -(screenPosition.y / rect.height) * 2 + 1,
              0 // NDC z-value (we'll set depth later)
            )

            // Set depth (z-coordinate in NDC space)
            // Assuming you want to place the entity at a specific distance from the camera
            // For example, at depth = -0.5 in NDC space corresponds to halfway between near and far planes
            const depth = position.z !== 0 ? position.z : -0.001 // Default depth
            ndc.z = -1 + 2 * ((depth - anchorCamera.value.near) / (anchorCamera.value.far - anchorCamera.value.near))

            // Unproject NDC to world space
            ndc.unproject(anchorCamera.value as ArrayCamera)

            finalPosition.copy(ndc)
          } else if (anchorLayout?.ornull?.effectiveSize.value) {
            // Handle anchor layout
            anchorSize = anchorLayout.effectiveSize.value
            finalPosition.set(
              position.x + positionOrigin.x * anchorSize.x - alignmentOrigin.x * size.x,
              position.y + positionOrigin.y * anchorSize.y - alignmentOrigin.y * size.y,
              position.z + positionOrigin.z * anchorSize.z - alignmentOrigin.z * size.z
            )
          } else if (anchorBounds?.box) {
            // Handle bounding box anchor
            anchorSize = anchorBounds.box.value.getSize(_size)
            finalPosition.set(
              position.x + positionOrigin.x * anchorSize.x - alignmentOrigin.x * size.x,
              position.y + positionOrigin.y * anchorSize.y - alignmentOrigin.y * size.y,
              position.z + positionOrigin.z * anchorSize.z - alignmentOrigin.z * size.z
            )
          } else {
            // Default case
            finalPosition.set(
              position.x - alignmentOrigin.x * size.x,
              position.y - alignmentOrigin.y * size.y,
              position.z - alignmentOrigin.z * size.z
            )
          }

          // Apply rotation origin offset
          rotationOriginOffset.set(
            (rotationOrigin.x - 0.5) * size.x,
            (rotationOrigin.y - 0.5) * size.y,
            (rotationOrigin.z - 0.5) * size.z
          )

          // Create a matrix to combine rotation and position
          matrix.compose(finalPosition, rotation, Vector3_One)

          // Apply rotation origin offset
          tempMatrix.makeTranslation(rotationOriginOffset.x, rotationOriginOffset.y, rotationOriginOffset.z)
          matrix.multiply(tempMatrix)
          tempMatrix.makeRotationFromQuaternion(rotation)
          matrix.multiply(tempMatrix)
          tempMatrix.makeTranslation(-rotationOriginOffset.x, -rotationOriginOffset.y, -rotationOriginOffset.z)
          matrix.multiply(tempMatrix)

          // Extract final position and rotation from the matrix
          matrix.decompose(finalPosition, finalRotation, finalScale)

          // Update the transform component
          const transform = getMutableComponent(entity, TransformComponent)
          transform.position.value.copy(finalPosition)
          transform.rotation.value.copy(finalRotation)
          transform.scale.value.copy(size)
          transform.matrix.value.copy(matrix)

          return false
        }
      })
    }, [anchorEntity])

    return null
  }
})