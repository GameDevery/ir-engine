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

import { Bone, MathUtils, Mesh, Object3D, Quaternion, Vector3 } from 'three'

import { VRM, VRMHumanBoneName } from '@pixiv/three-vrm'
import { Object3DUtils } from '../../common/functions/Object3DUtils'

const sqrEpsilon = 1e-8

/**
 * Returns angle 'a' in radians given lengths of sides of a triangle
 * @param {number} aLen
 * @param {number} bLen
 * @param {number} cLen
 * @returns angle 'a' in radians
 */
function triangleAngle(aLen: number, bLen: number, cLen: number): number {
  const c = MathUtils.clamp((bLen * bLen + cLen * cLen - aLen * aLen) / (bLen * cLen * 2), -1, 1)
  return Math.acos(c)
}

//mutates target position to constrain it to max distance
const distVector = new Vector3()
export function constrainTargetPosition(targetPosition: Vector3, constraintCenter: Vector3, distance: number) {
  distVector.subVectors(targetPosition, constraintCenter)
  distVector.clampLength(0, distance)
  targetPosition.copy(constraintCenter).add(distVector)
}

const hintHelpers = {} as Record<string, Mesh>

/**
 * Solves Two-Bone IK.
 * targetOffset is assumed to have no parents
 * @param {Bone} root root joint
 * @param {Bone} mid mid joint
 * @param {Bone} tip tip joint
 * @param {Object3D} target goal transform
 * @param {Object3D} hint Position of the hint
 * @param {Object3D} targetOffset Offset transform applied to the target
 * @param {number} targetPosWeight
 * @param {number} targetRotWeight
 * @param {number} hintWeight
 */
export function solveTwoBoneIK(
  rootName: VRMHumanBoneName,
  midName: VRMHumanBoneName,
  tipName: VRMHumanBoneName,
  vrm: VRM,
  targetPosition: Vector3, // world space
  targetRotation: Quaternion, // world space
  rotationOffset: Quaternion | null = null,
  hint: Vector3 | null = null,
  targetPosWeight = 1,
  targetRotWeight = 0,
  hintWeight = 1
) {
  targetPos.copy(targetPosition)
  targetRot.copy(targetRotation)

  const rawRoot = vrm.humanoid.getRawBoneNode(rootName)!
  const rawMid = vrm.humanoid.getRawBoneNode(midName)!
  const rawTip = vrm.humanoid.getRawBoneNode(tipName)!
  const root = vrm.humanoid.getNormalizedBoneNode(rootName)!
  const mid = vrm.humanoid.getNormalizedBoneNode(midName)!
  const tip = vrm.humanoid.getNormalizedBoneNode(tipName)!

  rootBoneWorldPosition.setFromMatrixPosition(rawRoot.matrixWorld)
  midBoneWorldPosition.setFromMatrixPosition(rawMid.matrixWorld)
  tipBoneWorldPosition.setFromMatrixPosition(rawTip.matrixWorld)

  /** Apply target position weight */
  if (targetPosWeight) targetPos.lerp(tipBoneWorldPosition, 1 - targetPosWeight)

  rootToMidVector.subVectors(midBoneWorldPosition, rootBoneWorldPosition)
  midToTipVector.subVectors(tipBoneWorldPosition, midBoneWorldPosition)
  rootToTipVector.subVectors(tipBoneWorldPosition, rootBoneWorldPosition)
  rootToTargetVector.subVectors(targetPos, rootBoneWorldPosition)

  const rootToMidLength = rootToMidVector.length()
  const midToTipLength = midToTipVector.length()
  const rootToTipLength = rootToTipVector.length()
  const maxLength = rootToMidLength + midToTipLength
  if (rootToTargetVector.lengthSq() > maxLength * maxLength) {
    rootToTargetVector.normalize().multiplyScalar((rootToMidLength + midToTipLength) * 0.999)
  }

  const rootToTargetLength = rootToTargetVector.length()

  const hasHint = hint && hintWeight > 0
  if (hasHint) rootToHintVector.copy(hint).sub(rootBoneWorldPosition)

  const oldAngle = triangleAngle(rootToTipLength, rootToMidLength, midToTipLength)
  const newAngle = triangleAngle(rootToTargetLength, rootToMidLength, midToTipLength)
  const rotAngle = oldAngle - newAngle

  rotAxis.crossVectors(rootToMidVector, midToTipVector)

  rot.setFromAxisAngle(rotAxis.normalize(), rotAngle)
  Object3DUtils.premultiplyWorldQuaternion(mid, rot)

  Object3DUtils.updateParentsMatrixWorld(tip, 1)

  tipBoneWorldPosition.setFromMatrixPosition(rawTip.matrixWorld)
  rootToTipVector.subVectors(tipBoneWorldPosition, rootBoneWorldPosition)

  rot.setFromUnitVectors(acNorm.copy(rootToTipVector).normalize(), atNorm.copy(rootToTargetVector).normalize())
  Object3DUtils.premultiplyWorldQuaternion(root, rot)

  /** Apply hint */
  if (hasHint) {
    if (rootToTipLength > 0) {
      Object3DUtils.updateParentsMatrixWorld(tip, 2)
      root.quaternion.identity()
      midBoneWorldPosition.setFromMatrixPosition(rawMid.matrixWorld)
      tipBoneWorldPosition.setFromMatrixPosition(rawTip.matrixWorld)
      rootToMidVector.subVectors(midBoneWorldPosition, rootBoneWorldPosition)
      rootToTipVector.subVectors(tipBoneWorldPosition, rootBoneWorldPosition)

      acNorm.copy(rootToTipVector).divideScalar(rootToTipLength)
      abProj.copy(rootToMidVector).addScaledVector(acNorm, -rootToMidVector.dot(acNorm)) // Prependicular component of vector projection
      ahProj.copy(rootToHintVector).addScaledVector(acNorm, -rootToHintVector.dot(acNorm))

      if (ahProj.lengthSq() > 0) {
        rot.setFromUnitVectors(abProj, ahProj)
        if (hintWeight > 0) {
          rot.x *= hintWeight
          rot.y *= hintWeight
          rot.z *= hintWeight
          Object3DUtils.premultiplyWorldQuaternion(root, rot)
        }
      }
    }
  }
  /** Apply tip rotation */
  Object3DUtils.getWorldQuaternion(tip, tip.quaternion)
  /** Apply target rotation weight */
  if (targetRotWeight === 1) {
    tip.quaternion.copy(targetRot)
  } else if (targetRotWeight > 0) {
    tip.quaternion.fastSlerp(targetRot, targetRotWeight)
  }
  Object3DUtils.worldQuaternionToLocal(tip.quaternion, mid)
  if (rotationOffset != undefined) tip.quaternion.premultiply(rotationOffset)
}

const targetPos = new Vector3(),
  rootBoneWorldPosition = new Vector3(),
  midBoneWorldPosition = new Vector3(),
  tipBoneWorldPosition = new Vector3(),
  rotAxis = new Vector3(),
  rootToMidVector = new Vector3(),
  midToTipVector = new Vector3(),
  rootToTipVector = new Vector3(),
  rootToTargetVector = new Vector3(),
  rootToHintVector = new Vector3(),
  acNorm = new Vector3(),
  atNorm = new Vector3(),
  abProj = new Vector3(),
  ahProj = new Vector3(),
  targetRot = new Quaternion(),
  rot = new Quaternion()
