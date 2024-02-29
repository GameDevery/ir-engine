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

import React from 'react'
import { useTranslation } from 'react-i18next'

import { instancePath } from '@etherealengine/common/src/schema.type.module'

import { useFind, useSearch } from '@etherealengine/spatial/src/common/functions/FeathersHooks'
import DataTable from '../../common/Table'

import { instanceColumns } from '../../common/constants/instance'

import { InstanceType } from '@etherealengine/common/src/schema.type.module'
import Button from '@etherealengine/ui/src/primitives/tailwind/Button'

export default function InstanceTable({ search }: { search: string }) {
  const { t } = useTranslation()
  const instancesQuery = useFind(instancePath, {
    query: {
      $sort: { createdAt: 1 },
      $limit: 20,
      action: 'admin'
    }
  })

  useSearch(instancesQuery, { search }, search)

  const createRows = (rows: readonly InstanceType[]) =>
    rows.map((row) => ({
      id: row.id,
      ipAddress: row.ipAddress,
      currentUsers: row.currentUsers,
      locationName: row.location.name,
      channelId: row.channelId,
      podName: row.podName,
      action: (
        <div className="flex w-full justify-around px-2 py-1">
          <Button>{t('admin:components.instance.actions.view')}</Button>
          <Button>{t('admin:components.instance.actions.delete')}</Button>
        </div>
      )
    }))

  return <DataTable query={instancesQuery} columns={instanceColumns} rows={createRows(instancesQuery.data)} />
}
