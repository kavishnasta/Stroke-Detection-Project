import { PermissionsAndroid, Platform } from 'react-native';

export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
    title: 'Camera permission',
    message: 'Camera access is required to analyze face and arm movement for FAST screening.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: 'Microphone permission',
    message: 'Microphone access is required for speech clarity checks during FAST screening.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function requestCorePermissions(): Promise<{ camera: boolean; microphone: boolean }> {
  const camera = await requestCameraPermission();
  const microphone = await requestMicrophonePermission();
  return { camera, microphone };
}
