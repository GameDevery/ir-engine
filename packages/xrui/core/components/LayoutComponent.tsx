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
  Entity,
  Static,
  UndefinedEntity,
  defineComponent,
  getComponent,
  getMutableComponent,
  getOptionalComponent,
  setComponent,
  useComponent,
  useEntityContext,
  useOptionalComponent
} from '@ir-engine/ecs'
import { S } from '@ir-engine/ecs/src/schemas/JSONSchemas'
import { State, getState, startReactor, useForceUpdate, useHookstate, useImmediateEffect } from '@ir-engine/hyperflux'
import { TransformComponent } from '@ir-engine/spatial'
import { CameraComponent } from '@ir-engine/spatial/src/camera/components/CameraComponent'
import { Vector3_One, Vector3_Zero } from '@ir-engine/spatial/src/common/constants/MathConstants'
import { RendererComponent } from '@ir-engine/spatial/src/renderer/WebGLRendererSystem'
import { MeshComponent } from '@ir-engine/spatial/src/renderer/components/MeshComponent'
import { BoundingBoxComponent } from '@ir-engine/spatial/src/transform/components/BoundingBoxComponents'
import { ComputedTransformComponent } from '@ir-engine/spatial/src/transform/components/ComputedTransformComponent'
import { useChildrenWithComponents } from '@ir-engine/spatial/src/transform/components/EntityTree'
import React from 'react'
import { ArrayCamera, Box3, Matrix4, Quaternion, Vector3 } from 'three'
import { Transition, TransitionData } from '../classes/Transition'

export enum SizeMode {
  proportional = 'proportional',
  literal = 'literal'
}

export enum ContentFit {
  contain = 'contain',
  cover = 'cover',
  fill = 'fill',
  none = 'none',
  scaleDown = 'scale-down'
}

const _size = new Vector3()

export const UnitSchema = S.Object({
  millimeters: S.Number(0),
  pixels: S.Number(0),
  percent: S.Number(0)
})

/**
 * Similar to CSS positioning, positive values correspond to right, down, and forward.
 */
export const Unit3Schema = S.Object({
  x: UnitSchema,
  y: UnitSchema,
  z: UnitSchema
})

export const Unit3StringSchema = S.Object({
  x: S.String(),
  y: S.String(),
  z: S.String()
})

function defineUnit3Transition() {
  return Transition.defineTransition<Static<typeof Unit3Schema>>({
    buffer: [
      {
        timestamp: 0,
        value: {
          x: { millimeters: 0, pixels: 0, percent: 0 },
          y: { millimeters: 0, pixels: 0, percent: 0 },
          z: { millimeters: 0, pixels: 0, percent: 0 }
        }
      }
    ],
    interpolationFunction: (a, b, t) => ({
      x: {
        millimeters: a.x.millimeters + (b.x.millimeters - a.x.millimeters) * t,
        pixels: a.x.pixels + (b.x.pixels - a.x.pixels) * t,
        percent: a.x.percent + (b.x.percent - a.x.percent) * t
      },
      y: {
        millimeters: a.y.millimeters + (b.y.millimeters - a.y.millimeters) * t,
        pixels: a.y.pixels + (b.y.pixels - a.y.pixels) * t,
        percent: a.y.percent + (b.y.percent - a.y.percent) * t
      },
      z: {
        millimeters: a.z.millimeters + (b.z.millimeters - a.z.millimeters) * t,
        pixels: a.z.pixels + (b.z.pixels - a.z.pixels) * t,
        percent: a.z.percent + (b.z.percent - a.z.percent) * t
      }
    })
  })
}

export const LayoutComponent = defineComponent({
  name: 'LayoutComponent',

  schema: S.Object({
    /**
     * Position the origin of this entity relative to the container entity.
     *
     * Similar to CSS positioning, positive values correspond to right, down, and forward.
     *
     * Default is { x: "0", y: "0", z: "0" } (top-left-back corner).
     *
     * Complex unit combinations can be used, e.g.:
     *
     * {x: "100% - 10px", y: "50mm", z: "0"}
     */
    position: S.Optional(Unit3Schema),
    positionTransition: defineUnit3Transition(),

    /**
     * Position the origin of this entity relative to itself.
     *
     * Similar to CSS positioning, positive values correspond to right, down, and forward.
     *
     * Default is { x: "0", y: "0", z: "0" }  (top-lef-back corner)
     *
     * Complex unit combinations can be used, e.g.:
     *
     * {x: "0", y: "50% + 10mm", z: "0"}
     */
    origin: S.Optional(Unit3Schema),
    originTransition: defineUnit3Transition(),

    /**
     * Rotation of the entity in quaternion form, about the rotation origin.
     */
    rotation: S.Optional(S.Quaternion()),
    rotationTransition: Transition.defineQuaternionTransition(),

    /**
     * Position the rotation origin of this entity relative to itself.
     *
     * Similar to CSS positioning, positive values correspond to right, down, and forward.
     *
     * Default is { x: "50%", y: "50%", z: "50%" }  (center)
     *
     * Complex unit combinations can be used, e.g.:
     *
     * {x: "50%", y: "50% + 10mm", z: "50%"}
     */
    rotationOrigin: S.Optional(Unit3Schema),
    rotationOriginTransition: defineUnit3Transition(),

    /**
     * Set the size of the entity.
     *
     * Default is { x: "100%", y: "100%", z: "100%" } (match container size).
     *
     * Complex unit combinations can be used, e.g.:
     *
     * {x: "100% + 10mm", y: "100%", z: "100%"}
     */
    size: S.Optional(Unit3Schema),
    sizeTransition: defineUnit3Transition(),

    /**
     * Content fit mode for the entity. Options include:
     * - contain: Scale the content to fit within the container container.
     * - cover: Scale the content to cover the container container.
     * - fill: Stretch the content to fill the container container.
     * - none: Do not scale the content.
     * - scaleDown: Scale the content down if necessary.
     *
     * Default is ContentFit.none.
     */
    contentFit: S.Optional(S.Enum(ContentFit)),
    contentFitTransition: Transition.defineVector3Transition(),

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
      }),
      contentFit: S.Enum(ContentFit, ContentFit.none)
    }),

    containerEntity: S.Entity()
  }),

  useRootContainerEntity(entity: Entity) {
    const containerEntities = [] as Entity[]
    let layout = getOptionalComponent(entity, LayoutComponent)
    while (layout?.containerEntity && !containerEntities.includes(layout.containerEntity)) {
      containerEntities.push(layout.containerEntity)
      layout = getOptionalComponent(layout.containerEntity, LayoutComponent)
    }

    const forceUpdate = useForceUpdate()
    React.useEffect(() => {
      const root = startReactor(() => {
        containerEntities.forEach((entity) => {
          useOptionalComponent(entity, LayoutComponent)?.containerEntity.value
        })
        forceUpdate()
        return null
      })
      return () => root.stop()
    }, containerEntities)

    return containerEntities[containerEntities.length - 1]
  },

  reactor: () => {
    const entity = useEntityContext()
    const layout = useComponent(entity, LayoutComponent)
    const effectiveLayout = LayoutComponent.useEffectiveState(entity)

    const simulationTime = getState(ECSState).simulationTime

    // This layout might be containered to another layout, or an object, or a camera.
    const containerEntity = layout.containerEntity.value
    const containerLayout = useOptionalComponent(containerEntity, LayoutComponent)
    const containerCamera = useOptionalComponent(containerEntity, CameraComponent)
    const containerRenderer = useOptionalComponent(containerEntity, RendererComponent)
    const containerBounds = useOptionalComponent(containerEntity, BoundingBoxComponent)

    const contentFitScale = Transition.useTransitionTarget(
      layout.positionTransition,
      effectiveLayout.position,
      simulationTime
    )
    Transition.useTransitionTarget(layout.originTransition, effectiveLayout.positionOrigin, simulationTime)
    Transition.useTransitionTarget(layout.alignmentTransition, effectiveLayout.alignmentOrigin, simulationTime)
    Transition.useTransitionTarget(layout.rotationTransition, effectiveLayout.rotation, simulationTime)
    Transition.useTransitionTarget(layout.rotationOriginTransition, effectiveLayout.rotationOrigin, simulationTime)
    Transition.useTransitionTarget(layout.sizeTransition, effectiveLayout.size, simulationTime)
    Transition.useTransitionTarget(layout.contentFitTransition, effectiveLayout.contentFit, simulationTime)

    // Reusable objects for calculations
    const finalPosition = new Vector3()
    const rotationOriginOffset = new Vector3()
    const matrix = new Matrix4()
    const tempMatrix = new Matrix4()
    const finalRotation = new Quaternion()
    const finalScale = new Vector3()

    useImmediateEffect(() => {
      setComponent(entity, ComputedTransformComponent, {
        referenceEntities: [containerEntity],

        computeFunction: () => {
          const frameTime = getState(ECSState).frameTime

          // Update transitions
          Transition.computeCurrentValue(frameTime, layout.positionTransition.value as TransitionData<Vector3>)
          Transition.computeCurrentValue(frameTime, layout.originTransition.value as TransitionData<Vector3>)
          Transition.computeCurrentValue(frameTime, layout.alignmentTransition.value as TransitionData<Vector3>)
          Transition.computeCurrentValue(frameTime, layout.rotationTransition.value as TransitionData<Quaternion>)
          Transition.computeCurrentValue(frameTime, layout.rotationOriginTransition.value as TransitionData<Vector3>)
          Transition.computeCurrentValue(frameTime, layout.contentFitTransition.value as TransitionData<Vector3>)

          // Get current values
          const position = layout.positionTransition.value.current
          const positionOrigin = layout.originTransition.value.current
          const alignmentOrigin = layout.alignmentTransition.value.current
          const rotation = layout.rotationTransition.value.current
          const rotationOrigin = layout.rotationOriginTransition.value.current
          const size = layout.effectiveSize.value
          const contentFit = layout.effectiveContentFit.value
          const contentFitScale = layout.contentFitTransition.value.current

          // Compute the final position
          const finalPosition = new Vector3()
          let containerSize = Vector3_Zero

          if (containerCamera?.value && containerRenderer?.canvas.value) {
            // Handle camera container
            const canvas = containerRenderer.canvas.value
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
            ndc.z =
              -1 + 2 * ((depth - containerCamera.value.near) / (containerCamera.value.far - containerCamera.value.near))

            // Unproject NDC to world space
            ndc.unproject(containerCamera.value as ArrayCamera)

            finalPosition.copy(ndc)
          } else if (containerLayout?.ornull?.effectiveSize.value) {
            // Handle container layout
            containerSize = containerLayout.effectiveSize.value
            finalPosition.set(
              position.x + positionOrigin.x * containerSize.x - alignmentOrigin.x * size.x,
              position.y + positionOrigin.y * containerSize.y - alignmentOrigin.y * size.y,
              position.z + positionOrigin.z * containerSize.z - alignmentOrigin.z * size.z
            )
          } else if (containerBounds?.worldSpaceBox) {
            // Handle bounding box container
            containerSize = containerBounds.worldSpaceBox.value.getSize(_size)
            finalPosition.set(
              position.x + positionOrigin.x * containerSize.x - alignmentOrigin.x * size.x,
              position.y + positionOrigin.y * containerSize.y - alignmentOrigin.y * size.y,
              position.z + positionOrigin.z * containerSize.z - alignmentOrigin.z * size.z
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
          transform.scale.value.copy(Vector3_One)
          transform.matrix.value.copy(matrix)

          // Apply content-fit to contentEntity
          if (layout.contentEntity.value !== UndefinedEntity) {
            const contentTransform = getMutableComponent(layout.contentEntity.value, TransformComponent)
            if (contentTransform) {
              const contentBounds = getComponent(layout.contentEntity.value, BoundingBoxComponent)

              if (contentBounds) {
                // Apply rotation to the content bounds
                const rotatedBox = contentBounds.objectSpaceBox.clone()
                rotatedBox.applyQuaternion(rotation)
                const contentSize = rotatedBox.getSize(new Vector3())
                const containerAspectRatio = size.x / size.y
                const contentAspectRatio = contentSize.x / contentSize.y

                let baseScaleX = 1
                let baseScaleY = 1

                switch (contentFit) {
                  case ContentFit.contain:
                    if (containerAspectRatio > contentAspectRatio) {
                      baseScaleX = baseScaleY = size.y / contentSize.y
                    } else {
                      baseScaleX = baseScaleY = size.x / contentSize.x
                    }
                    break
                  case ContentFit.cover:
                    if (containerAspectRatio > contentAspectRatio) {
                      baseScaleX = baseScaleY = size.x / contentSize.x
                    } else {
                      baseScaleX = baseScaleY = size.y / contentSize.y
                    }
                    break
                  case ContentFit.fill:
                    baseScaleX = size.x / contentSize.x
                    baseScaleY = size.y / contentSize.y
                    break
                  case ContentFit.none:
                    // No scaling
                    break
                  case ContentFit.scaleDown:
                    baseScaleX = baseScaleY = Math.min(1, size.x / contentSize.x, size.y / contentSize.y)
                    break
                }

                // Apply the contentFitScale
                contentTransform.scale.value.set(
                  baseScaleX * contentFitScale.x,
                  baseScaleY * contentFitScale.y,
                  contentFitScale.z
                )
              }
            }
          }

          return false
        }
      })
    }, [containerEntity, layout.contentEntity, layout.contentFit])

    return null
  }
})

function useLayoutBounds(entity: Entity): State<Vector3> {
  const bounds = useHookstate(() => new Box3())
  const layout = LayoutComponent.useEffectiveState(entity)
  const rotation = layout.rotation.value
  const meshes = useChildrenWithComponents(entity, [MeshComponent, TransformComponent])

  useImmediateEffect(() => {}, meshes)

  return bounds
}

/**
 * @param contentEntity
 * @returns oriented content size from the bounding box component
 */
function useContentSize(entity: Entity): State<Vector3> {
  const size = useHookstate(() => new Vector3())
  const layout = LayoutComponent.useEffectiveState(entity)
  const rotation = layout.rotation.value
  const boundingBox = useOptionalComponent(entity, BoundingBoxComponent)
  boundingBox?.objectSpaceBox.value
    .clone()
    .applyMatrix4(new Matrix4().makeRotationFromQuaternion(rotation))
    .getSize(size)
  return size
}

function useContentFitScale(effectiveContentFit: State<ContentFit>, contentSize: State<Vector3>) {}

function useEffectiveLayout(entity: Entity) {
  const layout = useComponent(entity, LayoutComponent)
  return {
    ...layout,
    position: layout.position.ornull ?? layout.defaults.position,
    positionOrigin: layout.origin.ornull ?? layout.defaults.positionOrigin,
    alignmentOrigin: layout.alignment.ornull ?? layout.defaults.alignmentOrigin,
    rotation: layout.rotation.ornull ?? layout.defaults.rotation,
    rotationOrigin: layout.rotationOrigin.ornull ?? layout.defaults.rotationOrigin,
    size: layout.size.ornull ?? layout.defaults.size,
    sizeMode: layout.sizeMode.ornull ?? layout.defaults.sizeMode,
    contentFit: layout.contentFit.ornull ?? layout.defaults.contentFit
  }
}
