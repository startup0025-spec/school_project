import { WaterType } from './place_model';

export interface AudioParams {
  waterType: WaterType;
  ambientVolume: number;
  windVolume: number;
  pitch: number;
  filterFrequency: number;
  alarmActive: boolean;
}
