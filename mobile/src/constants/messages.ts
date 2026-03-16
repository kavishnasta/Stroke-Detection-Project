export const Prompts = {
  faceIntro: "Let's check your face. Please look straight at the camera.",
  smilePrompt: "Now smile as wide as you can and hold it for 3 seconds.",
  eyebrowPrompt: "Raise both eyebrows as high as you can.",
  cheekPrompt: "Puff out both cheeks like you're holding air.",
  speechPrompt: 'Please read this phrase out loud, clearly and at your normal speed.',
  calibration: 'Look straight at the camera. Stay still for a moment.',
  armPrompt: 'Raise both arms straight out in front of you, palms up. Hold them steady for 10 seconds.',
} as const;

export const TrafficMessages = {
  green: 'Everything looks normal! No signs of concern detected.',
  yellow:
    "We noticed a slight difference on one side of your face. Let's try that test one more time to be sure.",
  red:
    'We detected noticeable asymmetry in your face. This could be a sign of stroke. Please call 911 immediately or ask someone nearby to help.',
} as const;

export const FindingMessages = {
  mouthAsymmetry: 'One side of your mouth appears to be drooping.',
  nasolabialFold: 'The crease between your nose and mouth looks flatter on one side.',
  cheekWeakness: "One cheek doesn't seem to be moving as much as the other.",
  eyebrowAsymmetry: "One eyebrow isn't raising as high as the other.",
  foreheadWeakness: "One side of your forehead isn't wrinkling when you raise your eyebrows.",
  speechChange: 'Your speech sounds different than expected. Words may be slurred.',
} as const;

export const Disclaimer =
  '⚠️ This app is NOT a medical device. It cannot diagnose a stroke. If you or someone near you shows ANY signs of stroke, call 911 immediately. Remember FAST: Face drooping, Arm weakness, Speech difficulty, Time to call 911.';

export const EmergencyReminder = 'When in doubt, call 911. It is better to be safe.';
