import { Component, Types } from "../systems/node_modules/ecsy";

export class Draggable extends Component {}
Draggable.schema = {
  value: { default: false, type: Types.Boolean }
};
