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

import { metabaseSettingPath } from '@etherealengine/common/src/schemas/integrations/metabase/metabase-setting.schema'
import type { Knex } from 'knex'

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw('SET FOREIGN_KEY_CHECKS=0')

  const tableExists = await knex.schema.hasTable(metabaseSettingPath)
  if (tableExists) {
    const environmentExists = await knex.schema.hasColumn(metabaseSettingPath, 'environment')
    if (environmentExists === false) {
      await knex.schema.alterTable(metabaseSettingPath, async (table) => {
        table.string('environment').nullable()
      })

      const metabaseSettings = await knex.table(metabaseSettingPath).first()

      if (metabaseSettings) {
        await knex.table(metabaseSettingPath).update({
          environment: process.env.METABASE_ENVIRONMENT
        })
      }
    }
  }
  await knex.raw('SET FOREIGN_KEY_CHECKS=1')
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw('SET FOREIGN_KEY_CHECKS=0')

  const tableExists = await knex.schema.hasTable(metabaseSettingPath)
  if (tableExists) {
    const environmentExists = await knex.schema.hasColumn(metabaseSettingPath, 'environment')
    if (environmentExists) {
      await knex.schema.alterTable(metabaseSettingPath, async (table) => {
        table.dropColumn('environment')
      })
    }
  }

  await knex.raw('SET FOREIGN_KEY_CHECKS=1')
}