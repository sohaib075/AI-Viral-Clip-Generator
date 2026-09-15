import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import { pickVideo, type PickedVideo } from '@/lib/pick-video';

interface Props {
  url: string;
  onUrlChange: (url: string) => void;
  video: PickedVideo | null;
  onVideoChange: (video: PickedVideo | null) => void;
  disabled?: boolean;
}

// A link or a video file from the device; choosing one clears the other
export function VideoSourceInput({ url, onUrlChange, video, onVideoChange, disabled }: Props) {
  const choose = async () => {
    try {
      const picked = await pickVideo();
      if (picked) {
        onVideoChange(picked);
        onUrlChange('');
      }
    } catch (e) {
      Alert.alert('Could not open files', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <View>
      <Text style={styles.label}>YOUTUBE OR WEB URL</Text>
      <TextInput
        style={[styles.input, video && styles.inputDisabled]}
        placeholder={video ? 'Remove the selected file to use a URL' : 'https://www.youtube.com/watch?v=...'}
        placeholderTextColor="#666"
        value={url}
        onChangeText={onUrlChange}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!video && !disabled}
        accessibilityLabel="Video URL"
      />

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={styles.uploadArea}
        onPress={choose}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={video ? `Selected file ${video.name}. Tap to choose another` : 'Choose a video file'}
      >
        <Text style={styles.uploadText} numberOfLines={1}>{video ? video.name : 'Tap to select video file'}</Text>
        <Text style={styles.uploadSubtext}>
          {video ? (video.size != null ? `${(video.size / (1024 * 1024)).toFixed(1)} MB` : 'Video selected') : 'MP4, MOV up to 2GB'}
        </Text>
      </TouchableOpacity>
      {video && (
        <TouchableOpacity onPress={() => onVideoChange(null)} style={styles.removeBtn} accessibilityRole="button">
          <Text style={styles.removeText}>Remove file</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: 'bold', color: '#a3a3a3', letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    color: '#fff',
    padding: 16,
    fontSize: 14,
    marginBottom: 16,
  },
  inputDisabled: { opacity: 0.5 },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { marginHorizontal: 10, fontSize: 10, fontWeight: 'bold', color: '#737373' },
  uploadArea: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  uploadText: { color: '#e5e5e5', fontWeight: '600', marginBottom: 4 },
  uploadSubtext: { color: '#737373', fontSize: 11 },
  removeBtn: { alignSelf: 'center', paddingVertical: 6, marginBottom: 8 },
  removeText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
});
