import React, { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Prompts } from '../constants/messages';
import { chooseSpeechPhrase } from '../analysis/speechAnalysis';
import { Severity } from '../types/landmarks';
import { BaseScreen } from '../ui/BaseScreen';
import { appStyles } from '../ui/theme';

type Props = {
  onComplete: (severity: Severity, details: { wer: number; pauses: number; durationSec: number }) => void;
};

export function SpeechTestScreen({ onComplete }: Props) {
  const phrase = useMemo(() => chooseSpeechPhrase(Date.now()), []);
  const [severity, setSeverity] = useState<Severity>('green');

  return (
    <BaseScreen title="Step 3 of 3: Speech Check">
      <View style={appStyles.card}>
        <Text style={appStyles.subtitle}>Read this phrase:</Text>
        <Text style={[appStyles.body, { fontSize: 24, lineHeight: 32 }]}>{phrase}</Text>
      </View>
      <View style={appStyles.card}>
        <Text style={appStyles.body}>{Prompts.speechPrompt}</Text>
        <Text style={appStyles.body}>Start recording and speech recognition together. Timeout after 15 seconds.</Text>
      </View>

      <TouchableOpacity style={appStyles.button} onPress={() => setSeverity('green')}>
        <Text style={appStyles.buttonText}>Mark Simulated GREEN</Text>
      </TouchableOpacity>
      <TouchableOpacity style={appStyles.button} onPress={() => setSeverity('yellow')}>
        <Text style={appStyles.buttonText}>Mark Simulated YELLOW</Text>
      </TouchableOpacity>
      <TouchableOpacity style={appStyles.button} onPress={() => setSeverity('red')}>
        <Text style={appStyles.buttonText}>Mark Simulated RED</Text>
      </TouchableOpacity>
      <TouchableOpacity style={appStyles.button} onPress={() => onComplete(severity, { wer: severity === 'green' ? 0.08 : 0.39, pauses: severity === 'green' ? 1 : 4, durationSec: severity === 'green' ? 2.4 : 6.4 })}>
        <Text style={appStyles.buttonText}>✓ Speech check complete</Text>
      </TouchableOpacity>
    </BaseScreen>
  );
}
