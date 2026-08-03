import TrackPlayer, { Event } from 'react-native-track-player';
import { DeviceEventEmitter } from 'react-native';

const PlaybackService = async function () {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    console.log('[TrackPlayer Service] RemotePlay');
    TrackPlayer.play();
    DeviceEventEmitter.emit('onMediaSessionPlay');
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    console.log('[TrackPlayer Service] RemotePause');
    TrackPlayer.pause();
    DeviceEventEmitter.emit('onMediaSessionPause');
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    console.log('[TrackPlayer Service] RemoteStop');
    TrackPlayer.pause();
    DeviceEventEmitter.emit('onMediaSessionPause');
  });
};

export default PlaybackService;
module.exports = PlaybackService;
