import HADevice from './base.js'
import { Device as ClipDevice } from "../devmgr.js"
import { type Connection } from '../homeassistant.js'
import { ClipDeployMessage } from '../../util/clip.js'
import { allowExtendedType } from '../../util/util.js'
import AABBDevice from './aabb_device.js'

const ERRORS = ['ok','door_lock_error','door_open_error','water_supply_error','water_drain_error','out_of_balance_error','overfill_error','water_level_sensor_error','temperature_sensor_error','locked_motor_error',undefined,'dHE_error','power_fail_error','FF_error','DCE_error','AE_error','eeprom_error','PS_error','door_sensor_error','vibration_sensor_error','LE8_error','LE9_error','ED1_error','ED2_error','ED3_error','ED4_error','ED5_error']
const STATES = ['power_off','initial','pause',undefined,'detecting',undefined,'running','rinsing','spinning','drying','end','cool_down','rinse_hold',undefined,'refreshing','steam_softening','demo',undefined,'error','auto_dt_open_pause']

export default class Device extends AABBDevice {
    constructor(HA: Connection, clipDevice: ClipDevice, provisionMsg: ClipDeployMessage) {
        super(HA, 'device', clipDevice)
        this.setConfig(allowExtendedType({
            ...HADevice.deviceConfig(provisionMsg, { name: "LG Washer" }),
            components: {
                power: { platform: 'switch', unique_id: '$deviceid-power', state_topic: '$this/power', command_topic: '$this/power/set', name: 'Power' },
                status: { platform: 'sensor', unique_id: '$deviceid-status', state_topic: '$this/status', name: 'Current status', options: [ ...STATES.filter((a) => a !== undefined), 'unknown_status' ] },
                remaining_time: { platform: 'sensor', unique_id: '$deviceid-remaining_time', state_topic: '$this/remaining_time', device_class: 'duration', unit_of_measurement: 'min', name: 'Remaining time' },
                operation: { platform: 'select', unique_id: '$deviceid-operation', command_topic: '$this/operation/set', name: 'Operation', options: [ 'stop', 'power_off', 'wake_up' ] }
            }
        }))
    }

    query() { this.send(Buffer.from('F0ED1121010000001800', 'hex')) }

    processAABB(buf: Buffer) {
        // Look specifically for 20EB or 20EC status packets
        if(buf.length >= 34 && buf[0] === 0x20 && (buf[1] === 0xEB || buf[1] === 0xEC)) {
            
            const status = buf[4];
            const hoursLeft = buf[5];
            const minsLeft = buf[6];
            const tremain = (hoursLeft * 60) + minsLeft;

            this.publishProperty('power', status > 0 ? 'ON' : 'OFF');
            this.publishProperty('status', STATES[status] ?? `unknown_status_${status}`);
            this.publishProperty('remaining_time', tremain);
        }
    }

    setProperty(prop: string, mqttValue: string) {
        if(prop === 'power' && mqttValue === 'OFF') this.send(Buffer.from('f024010100', 'hex'));
        if(prop === 'operation') {
            if(mqttValue === 'stop') this.send(Buffer.from('F024040100', 'hex'));
            if(mqttValue === 'power_off') this.send(Buffer.from('f024010100', 'hex'));
            if(mqttValue === 'wake_up') this.send(Buffer.from('F02A0100', 'hex'));
        }
    }
}