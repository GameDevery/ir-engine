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
  AnimationSystemGroup,
  ECSState,
  defineComponent,
  useComponent,
  useEntityContext,
  useExecute,
  useOptionalComponent
} from '@ir-engine/ecs'
import { getState, useImmediateEffect } from '@ir-engine/hyperflux'
import { TransformComponent } from '@ir-engine/spatial'
import { Vector3_One, Vector3_Zero } from '@ir-engine/spatial/src/common/constants/MathConstants'
import { useAncestorWithComponents } from '@ir-engine/spatial/src/transform/components/EntityTree'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { Transition, TransitionData } from '../classes/Transition'

export interface SizeMode {
  x: 'proportional' | 'literal'
  y: 'proportional' | 'literal'
  z: 'proportional' | 'literal'
}

export const LayoutComponent = defineComponent({
  name: 'LayoutComponent',

  onInit: () => {
    return {
      /** The absolute position of the element relative to its parent. */
      position: null as Vector3 | null,
      /** Transition data for smooth position changes. */
      positionTransition: Transition.defineVector3Transition(),
      /** Computed effective position after considering defaults. */
      effectivePosition: new Vector3(),

      /** The origin point for positioning within the parent. (0,0,0) is top-left-front, (1,1,1) is bottom-right-back. */
      positionOrigin: null as Vector3 | null,
      /** Transition data for smooth position origin changes. */
      positionOriginTransition: Transition.defineVector3Transition(),
      /** Computed effective position origin after considering defaults. */
      effectivePositionOrigin: new Vector3(),

      /** The alignment point of the element itself. (0,0,0) aligns top-left-front, (0.5,0.5,0.5) centers the element. */
      alignmentOrigin: null as Vector3 | null,
      /** Transition data for smooth alignment origin changes. */
      alignmentTransition: Transition.defineVector3Transition(),
      /** Computed effective alignment origin after considering defaults. */
      effectiveAlignmentOrigin: new Vector3(),

      /** The rotation of the element. */
      rotation: null as Quaternion | null,
      /** Transition data for smooth rotation changes. */
      rotationTransition: Transition.defineQuaternionTransition(),
      /** Computed effective rotation after considering defaults. */
      effectiveRotation: new Quaternion(),

      /** The point around which the element rotates. (0,0,0) is element's top-left-front, (0.5,0.5,0.5) is center. */
      rotationOrigin: null as Vector3 | null,
      /** Transition data for smooth rotation origin changes. */
      rotationOriginTransition: Transition.defineVector3Transition(),
      /** Computed effective rotation origin after considering defaults. */
      effectiveRotationOrigin: new Vector3(),

      /** The dimensions of the element. Can be absolute or proportional based on sizeMode. */
      size: null as Vector3 | null,
      /** Determines how size is interpreted for each axis: 'proportional' or 'literal'. */
      sizeMode: null as SizeMode | null,
      /** Transition data for smooth size changes. */
      sizeTransition: Transition.defineVector3Transition(),
      /** Computed effective size after considering parent size, sizeMode, and defaults. */
      effectiveSize: new Vector3(),

      /** Default values for all properties. Used when the corresponding property is null. */
      defaults: {
        position: new Vector3(),
        positionOrigin: new Vector3(),
        alignmentOrigin: new Vector3(),
        rotation: new Quaternion(),
        rotationOrigin: new Vector3(),
        size: new Vector3(),
        sizeMode: { x: 'literal', y: 'literal', z: 'literal' } as SizeMode
      }
    }
  },

  reactor: () => {
    const entity = useEntityContext()
    const layout = useComponent(entity, LayoutComponent)
    const parentEntity = useAncestorWithComponents(entity, [LayoutComponent])
    const parentLayout = useOptionalComponent(parentEntity, LayoutComponent)
    const transform = useComponent(entity, TransformComponent)

    // Compute effective properties
    useImmediateEffect(() => {
      if (!layout) return

      // Effective position (always absolute)
      const position = layout.position.value ?? layout.defaults.position.value
      layout.effectivePosition.set(new Vector3(position.x, position.y, position.z))

      // Effective size (remains proportional or literal based on sizeMode)
      const sizeMode = layout.sizeMode.value ?? layout.defaults.sizeMode.value
      const size = layout.size.value ?? layout.defaults.size.value
      const parentSize = parentLayout?.effectiveSize.value ?? Vector3_Zero
      layout.effectiveSize.set(
        new Vector3(
          sizeMode.x === 'proportional' ? size.x * parentSize.x : size.x,
          sizeMode.y === 'proportional' ? size.y * parentSize.y : size.y,
          sizeMode.z === 'proportional' ? size.z * parentSize.z : size.z
        )
      )

      // Effective position origin
      const positionOrigin = layout.positionOrigin.value ?? layout.defaults.positionOrigin.value
      layout.effectivePositionOrigin.set(new Vector3(positionOrigin.x, positionOrigin.y, positionOrigin.z))

      // Effective alignment origin
      const alignmentOrigin = layout.alignmentOrigin.value ?? layout.defaults.alignmentOrigin.value
      layout.effectiveAlignmentOrigin.set(new Vector3(alignmentOrigin.x, alignmentOrigin.y, alignmentOrigin.z))

      // Effective rotation
      const rotation = layout.rotation.value ?? layout.defaults.rotation.value
      layout.effectiveRotation.set(new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w))

      // Effective rotation origin
      const rotationOrigin = layout.rotationOrigin.value ?? layout.defaults.rotationOrigin.value
      layout.effectiveRotationOrigin.set(new Vector3(rotationOrigin.x, rotationOrigin.y, rotationOrigin.z))
    }, [
      layout?.position,
      layout?.size,
      layout?.sizeMode,
      parentLayout?.effectiveSize.value,
      layout?.positionOrigin,
      layout?.alignmentOrigin,
      layout?.rotation,
      layout?.rotationOrigin
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
    }, [
      layout?.positionTransition,
      layout?.positionOriginTransition,
      layout?.alignmentTransition,
      layout?.rotationTransition,
      layout?.rotationOriginTransition
    ])

    // Reusable objects for calculations
    const finalPosition = new Vector3()
    const rotationOriginOffset = new Vector3()
    const matrix = new Matrix4()
    const tempMatrix = new Matrix4()
    const finalRotation = new Quaternion()
    const finalScale = new Vector3()

    // Update transitions every frame
    useExecute(
      () => {
        if (!layout || !transform) return
        const frameTime = getState(ECSState).frameTime

        Transition.computeCurrentValue(frameTime, layout.positionTransition.value as TransitionData<Vector3>)
        Transition.computeCurrentValue(frameTime, layout.positionOriginTransition.value as TransitionData<Vector3>)
        Transition.computeCurrentValue(frameTime, layout.alignmentTransition.value as TransitionData<Vector3>)
        Transition.computeCurrentValue(frameTime, layout.rotationTransition.value as TransitionData<Quaternion>)
        Transition.computeCurrentValue(frameTime, layout.rotationOriginTransition.value as TransitionData<Vector3>)
        // The current values are now stored in the TransitionData.current property
        const position = layout.positionTransition.value.current
        const positionOrigin = layout.positionOriginTransition.value.current
        const alignmentOrigin = layout.alignmentTransition.value.current
        const rotation = layout.rotationTransition.value.current
        const rotationOrigin = layout.rotationOriginTransition.value.current
        const size = layout.effectiveSize.value

        // Compute the final position
        if (parentLayout) {
          const parentSize = parentLayout.effectiveSize.value
          finalPosition.set(
            position.x + positionOrigin.x * parentSize.x - alignmentOrigin.x * size.x,
            position.y + positionOrigin.y * parentSize.y - alignmentOrigin.y * size.y,
            position.z + positionOrigin.z * parentSize.z - alignmentOrigin.z * size.z
          )
        } else {
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
        transform.position.value.copy(finalPosition)
        transform.rotation.value.copy(finalRotation)
        transform.scale.value.copy(size)
      },
      {
        with: AnimationSystemGroup
      }
    )

    return null
  }
})