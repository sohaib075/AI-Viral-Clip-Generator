import React, { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Image,
  Linking,
  Modal,
  TextInput,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import api, { errorMessage, mediaUrl } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import { PLATFORMS, platformName, type Account, type ClipData, type JobStatusResponse, type PlatformCopy } from '@/lib/types';

interface ClipView {
  id: string;
  url: string;
  baseUrl: string | null;
  title: string;
  duration: string | null;
  score: number | null;
  reasoning: string;
  metadata: Record<string, PlatformCopy>;
  layout: string;
  thumbnail: string | null;
  source: ClipData;
}

type Shape = 'vertical' | 'horizontal' | 'square';
const shapeOf = (layout: string): Shape =>
  layout === 'horizontal' || layout === '16:9' ? 'horizontal' : layout === '1:1' ? 'square' : 'vertical';

const toClip = (c: ClipData, index: number): ClipView => {
  const start = typeof c.start_time === 'number' ? c.start_time : 0;
  return {
    id: String(index),
    url: mediaUrl(c.video_url) || '',
    baseUrl: mediaUrl(c.base_url),
    title: c.title || `Clip ${index + 1}`,
    duration: typeof c.end_time === 'number' ? formatDuration(c.end_time - start) : null,
    score: typeof c.score === 'number' && c.score > 0 ? c.score : null,
    reasoning: c.reasoning || '',
    metadata: c.metadata || {},
    layout: c.layout || 'vertical',
    thumbnail: mediaUrl(c.thumbnail_url),
    source: c,
  };
};

// ASS colors are &HAABBGGRR
const COLORS = [
  { name: 'White', ass: '&H00FFFFFF', css: '#ffffff' },
  { name: 'Yellow', ass: '&H0000FFFF', css: '#ffff00' },
  { name: 'Green', ass: '&H0000FF00', css: '#00ff00' },
  { name: 'Blue', ass: '&H00FF0000', css: '#0000ff' },
  { name: 'Red', ass: '&H000000FF', css: '#ff0000' },
];
const THEMES: Record<string, { fontName: string; primaryColor: string; highlightColor: string }> = {
  Modern: { fontName: 'Arial Black', primaryColor: '&H00FFFFFF', highlightColor: '&H0000FFFF' },
  Viral: { fontName: 'Arial Black', primaryColor: '&H00FFFFFF', highlightColor: '&H0000FFFF' },
  Podcast: { fontName: 'Arial', primaryColor: '&H00FFFFFF', highlightColor: '&H0000FF00' },
  Gaming: { fontName: 'Verdana', primaryColor: '&H0000FFFF', highlightColor: '&H0000FF00' },
};
const SIZES = { Small: 0.75, Medium: 1, Large: 1.3 } as const;
const POSITIONS = { Low: 0.05, Middle: 0.4, High: 0.75 } as const;
type SizeName = keyof typeof SIZES;
type PositionName = keyof typeof POSITIONS;

const SOCIAL = [
  { key: 'tiktok', label: 'TikTok' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'youtube_shorts', label: 'YouTube Shorts' },
  { key: 'x', label: 'X' },
  { key: 'linkedin', label: 'LinkedIn (copy only)' },
];
const hashtagText = (tags?: string[]) => (tags || []).map(t => `#${t.replace(/^#/, '')}`).join(' ');
const copyText = (copy: PlatformCopy) =>
  [copy.title, copy.description ?? copy.post ?? copy.tweet, hashtagText(copy.hashtags)].filter(Boolean).join('\n\n');

type Schedule = 'now' | 'hour' | 'tomorrow';

const Chip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
  <TouchableOpacity
    style={[styles.chip, selected && styles.chipActive]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected }}
  >
    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

export default function ResultsScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { width: screenWidth } = useWindowDimensions();
  const [state, setState] = useState<'loading' | 'ready' | 'processing' | 'failed' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [clips, setClips] = useState<ClipView[]>([]);
  const [clip, setClip] = useState<ClipView | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'final' | 'customizer' | 'social'>('final');

  // Customizer
  const [theme, setTheme] = useState('Modern');
  const [primaryColor, setPrimaryColor] = useState(THEMES.Modern.primaryColor);
  const [highlightColor, setHighlightColor] = useState(THEMES.Modern.highlightColor);
  const [size, setSize] = useState<SizeName>('Medium');
  const [position, setPosition] = useState<PositionName>('Low');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportedAt, setExportedAt] = useState<Record<string, number>>({});
  const [exportError, setExportError] = useState('');

  // Publishing
  const [publishOpen, setPublishOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [schedule, setSchedule] = useState<Schedule>('now');
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    if (!jobId) {
      setLoadError('No job was selected.');
      setState('error');
      return;
    }
    setState('loading');
    try {
      const { data } = await api.get<JobStatusResponse>(`/api/jobs/${encodeURIComponent(jobId)}`);
      if (data.status === 'processing') return setState('processing');
      if (data.status === 'failed') {
        setLoadError(data.message || 'This job failed.');
        return setState('failed');
      }
      const mapped = (data.clips || []).map(toClip);
      setClips(mapped);
      setClip(mapped[0] ?? null);
      setWarnings(data.warnings || []);
      setState('ready');
    } catch (e) {
      setLoadError(errorMessage(e, 'Could not load the results.'));
      setState('error');
    }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const finalUrl = clip
    ? `${clip.url}${exportedAt[clip.id] ? `${clip.url.includes('?') ? '&' : '?'}v=${exportedAt[clip.id]}` : ''}`
    : null;

  // One player whose source follows the selected clip
  const player = useVideoPlayer(null, p => { p.loop = true; });
  useEffect(() => {
    if (!finalUrl) return;
    player.replace(finalUrl);
    player.play();
  }, [finalUrl, player]);

  const selectClip = (next: ClipView) => {
    setClip(next);
    setExportError('');
    if (activeTab === 'customizer' && !next.baseUrl) setActiveTab('final');
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const handleExport = async () => {
    if (!clip?.baseUrl) return;
    const target = clip;
    const shape = shapeOf(target.layout);
    const playResY = shape === 'vertical' ? 1920 : 1080;
    setExportingId(target.id);
    setExportError('');
    try {
      await api.post('/api/export', {
        jobId,
        clipUrl: target.baseUrl,
        clipData: target.source,
        styleConfig: {
          theme,
          fontName: THEMES[theme].fontName,
          fontSize: Math.round((shape === 'vertical' ? 64 : 44) * SIZES[size]),
          primaryColor,
          highlightColor,
          marginV: Math.round(playResY * POSITIONS[position]),
        },
      }, { timeout: 10 * 60 * 1000 });
      setExportedAt(prev => ({ ...prev, [target.id]: Date.now() }));
      setActiveTab('final');
    } catch (e) {
      setExportError(errorMessage(e, 'Export failed.'));
    } finally {
      setExportingId(current => (current === target.id ? null : current));
    }
  };

  const openPublish = async () => {
    if (!clip) return;
    const youtube = clip.metadata.youtube_shorts;
    setTitle(clip.title);
    setDescription(youtube?.description || '');
    setHashtags(hashtagText(youtube?.hashtags));
    setSchedule('now');
    setPublishResult(null);
    setPlatforms([]);
    setPublishOpen(true);
    try {
      const { data } = await api.get<Account[]>('/api/accounts');
      setAccounts(data);
      setPlatforms(PLATFORMS.map(p => p.id).filter(id => data.some(a => a.platform === id)));
    } catch {
      setAccounts([]);
    }
  };

  const publish = async () => {
    if (!clip) return;
    setPublishing(true);
    setPublishResult(null);
    const scheduled_time = schedule === 'hour'
      ? new Date(Date.now() + 3600000).toISOString()
      : schedule === 'tomorrow' ? new Date(Date.now() + 86400000).toISOString() : 'now';
    try {
      await api.post('/api/posts', { clip_url: clip.url, platforms, title: title || clip.title, description, hashtags, scheduled_time });
      setPublishResult({ ok: true, message: 'Post scheduled. Track it in the Queue tab.' });
    } catch (e) {
      setPublishResult({ ok: false, message: errorMessage(e, 'Failed to schedule the post.') });
    } finally {
      setPublishing(false);
    }
  };

  if (state !== 'ready') {
    const copy = {
      loading: { title: '', body: '' },
      processing: { title: 'Still processing', body: 'This job is not finished yet.' },
      failed: { title: 'This job failed', body: loadError },
      error: { title: 'Could not load results', body: loadError },
    }[state];
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        {state === 'loading' ? <ActivityIndicator size="large" color="#66fcf1" /> : (
          <>
            <Text style={styles.stateTitle}>{copy.title}</Text>
            {copy.body ? <Text style={styles.stateBody}>{copy.body}</Text> : null}
            {state === 'processing' && jobId && (
              <TouchableOpacity style={styles.primaryBtnWide} onPress={() => router.replace({ pathname: '/processing/[jobId]', params: { jobId } })}>
                <Text style={styles.primaryBtnText}>View progress</Text>
              </TouchableOpacity>
            )}
            {state === 'error' && (
              <TouchableOpacity style={styles.primaryBtnWide} onPress={load}>
                <Text style={styles.primaryBtnText}>Try again</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.secondaryBtnWide} onPress={goBack}>
              <Text style={styles.secondaryBtnText}>Go back</Text>
            </TouchableOpacity>
          </>
        )}
      </SafeAreaView>
    );
  }

  const shape = shapeOf(clip?.layout || 'vertical');
  const videoWidth = shape === 'horizontal' ? Math.min(screenWidth - 40, 560) : shape === 'square' ? Math.min(screenWidth - 40, 340) : Math.min(screenWidth - 80, 280);
  const videoHeight = shape === 'horizontal' ? videoWidth * 9 / 16 : shape === 'square' ? videoWidth : videoWidth * 16 / 9;
  const tabs = [
    { id: 'final' as const, label: 'Final Output', show: true },
    { id: 'customizer' as const, label: 'Customizer', show: Boolean(clip?.baseUrl) },
    { id: 'social' as const, label: 'Social Pack', show: Boolean(clip && Object.keys(clip.metadata).length) },
  ].filter(t => t.show);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{clip?.title || 'Results'}</Text>
      </View>

      {!clip ? (
        <View style={[styles.center, { flex: 1 }]}>
          <Text style={styles.stateTitle}>No clips</Text>
          <Text style={styles.stateBody}>This job didn't produce any videos.</Text>
        </View>
      ) : (
        <>
          <View style={styles.tabsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
              {tabs.map(tab => (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive]}
                  onPress={() => setActiveTab(tab.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === tab.id }}
                >
                  <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {warnings.length > 0 && (
              <View style={styles.warningBox}>
                {warnings.map(w => <Text key={w} style={styles.warningText}>⚠ {w}</Text>)}
              </View>
            )}

            <View style={styles.videoPlayerContainer}>
              <VideoView
                style={[styles.video, { width: videoWidth, height: videoHeight }]}
                player={player}
                allowsFullscreen
                allowsPictureInPicture
                nativeControls
                contentFit="contain"
              />
            </View>

            {/* Clip Selection Horizontal List */}
            {clips.length > 1 && (
              <View style={styles.clipSelector}>
                <Text style={styles.sectionTitleSmall}>Select Clip</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 12}}>
                  {clips.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => selectClip(c)}
                      style={[styles.clipThumbnailWrapper, clip.id === c.id && styles.clipThumbnailActive]}
                      accessibilityRole="button"
                      accessibilityLabel={c.title}
                      accessibilityState={{ selected: clip.id === c.id }}
                    >
                      {c.thumbnail
                        ? <Image source={{ uri: c.thumbnail }} style={styles.clipThumbnail} />
                        : <View style={[styles.clipThumbnail, styles.thumbnailFallback]}><Text style={styles.thumbnailFallbackText}>▶</Text></View>}
                      {c.score !== null && (
                        <View style={styles.clipScoreBadge}>
                          <Text style={styles.clipScoreText}>{c.score}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {activeTab === 'final' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Ready to Post</Text>
                <Text style={styles.sectionDesc}>
                  {exportedAt[clip.id] ? 'Your customized export with burned-in captions.' : 'The generated video with burned-in, synced captions.'}
                  {clip.duration ? ` Length ${clip.duration}.` : ''}
                </Text>
                {clip.reasoning ? <Text style={styles.reasoning}>{clip.reasoning}</Text> : null}

                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => finalUrl && Linking.openURL(finalUrl)} accessibilityRole="button">
                    <Text style={styles.primaryBtnText}>Open / Download</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={openPublish} accessibilityRole="button">
                    <Text style={styles.secondaryBtnText}>Auto-Publish</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.linkBtn} onPress={() => finalUrl && Share.share({ message: finalUrl })} accessibilityRole="button">
                  <Text style={styles.copyText}>Share video link</Text>
                </TouchableOpacity>
              </View>
            )}

            {activeTab === 'customizer' && clip.baseUrl && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Caption Customizer</Text>
                <Text style={styles.sectionDesc}>Re-render this clip's captions with your own style. The export replaces its final video.</Text>

                <Text style={styles.label}>THEME</Text>
                <View style={styles.chipRow}>
                  {Object.keys(THEMES).map(name => (
                    <Chip key={name} label={name} selected={theme === name} onPress={() => {
                      setTheme(name);
                      setPrimaryColor(THEMES[name].primaryColor);
                      setHighlightColor(THEMES[name].highlightColor);
                    }} />
                  ))}
                </View>

                <Text style={styles.label}>TEXT COLOR</Text>
                <View style={styles.chipRow}>
                  {COLORS.map(c => <Chip key={c.ass} label={c.name} selected={primaryColor === c.ass} onPress={() => setPrimaryColor(c.ass)} />)}
                </View>

                <Text style={styles.label}>HIGHLIGHT</Text>
                <View style={styles.chipRow}>
                  {COLORS.map(c => <Chip key={c.ass} label={c.name} selected={highlightColor === c.ass} onPress={() => setHighlightColor(c.ass)} />)}
                </View>

                <Text style={styles.label}>SIZE</Text>
                <View style={styles.chipRow}>
                  {(Object.keys(SIZES) as SizeName[]).map(name => <Chip key={name} label={name} selected={size === name} onPress={() => setSize(name)} />)}
                </View>

                <Text style={styles.label}>POSITION</Text>
                <View style={styles.chipRow}>
                  {(Object.keys(POSITIONS) as PositionName[]).map(name => <Chip key={name} label={name} selected={position === name} onPress={() => setPosition(name)} />)}
                </View>

                <View style={[styles.preview, { borderColor: COLORS.find(c => c.ass === highlightColor)?.css }]}>
                  <Text style={{ color: COLORS.find(c => c.ass === primaryColor)?.css, fontWeight: '900', fontSize: 18 * SIZES[size] }}>
                    Your <Text style={{ color: COLORS.find(c => c.ass === highlightColor)?.css }}>captions</Text> here
                  </Text>
                </View>

                {exportError ? <Text style={styles.errorText}>{exportError}</Text> : null}
                <TouchableOpacity
                  style={[styles.primaryBtn, exportingId === clip.id && styles.btnDisabled]}
                  onPress={handleExport}
                  disabled={exportingId === clip.id}
                  accessibilityRole="button"
                >
                  {exportingId === clip.id
                    ? <ActivityIndicator color="#000" />
                    : <Text style={styles.primaryBtnText}>{exportedAt[clip.id] ? 'Export Again' : 'Burn Subtitles & Export'}</Text>}
                </TouchableOpacity>
              </View>
            )}

            {activeTab === 'social' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Social Media Pack</Text>
                <Text style={styles.sectionDesc}>AI generated ready-to-post content.</Text>

                {SOCIAL.filter(s => clip.metadata[s.key]).map(s => {
                  const copy = clip.metadata[s.key];
                  return (
                    <View key={s.key} style={styles.socialCard}>
                      <View style={styles.socialHeader}>
                        <Text style={styles.socialPlatform}>{s.label}</Text>
                        <TouchableOpacity onPress={() => Share.share({ message: copyText(copy) })} accessibilityRole="button">
                          <Text style={styles.copyText}>Share Text</Text>
                        </TouchableOpacity>
                      </View>
                      {copy.title ? <Text style={styles.socialTitle}>{copy.title}</Text> : null}
                      {(copy.description || copy.post || copy.tweet) ? <Text style={styles.socialDesc}>{copy.description || copy.post || copy.tweet}</Text> : null}
                      {copy.hashtags?.length ? <Text style={styles.socialHashtags}>{hashtagText(copy.hashtags)}</Text> : null}
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </>
      )}

      <Modal visible={publishOpen} animationType="slide" transparent onRequestClose={() => setPublishOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView>
              <View style={styles.socialHeader}>
                <Text style={styles.sectionTitle}>Publish Video</Text>
                <TouchableOpacity onPress={() => setPublishOpen(false)} accessibilityRole="button" accessibilityLabel="Close">
                  <Text style={styles.backBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>PLATFORMS</Text>
              <View style={styles.chipRow}>
                {PLATFORMS.map(p => {
                  const connected = accounts.some(a => a.platform === p.id);
                  const selected = platforms.includes(p.id);
                  return (
                    <Chip
                      key={p.id}
                      label={connected ? p.name : `${p.name} (not connected)`}
                      selected={selected}
                      onPress={() => setPlatforms(prev => (selected ? prev.filter(x => x !== p.id) : [...prev, p.id]))}
                    />
                  );
                })}
              </View>
              {platforms.some(id => !accounts.some(a => a.platform === id)) && (
                <TouchableOpacity onPress={() => { setPublishOpen(false); router.push('/accounts'); }}>
                  <Text style={styles.warningText}>Posts to platforms that aren't connected will fail. Tap to connect accounts.</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.label}>TITLE</Text>
              <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor="#666" accessibilityLabel="Title" />
              <Text style={styles.label}>DESCRIPTION</Text>
              <TextInput style={[styles.input, { height: 90, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription} multiline accessibilityLabel="Description" />
              <Text style={styles.label}>HASHTAGS</Text>
              <TextInput style={styles.input} value={hashtags} onChangeText={setHashtags} autoCapitalize="none" accessibilityLabel="Hashtags" />

              <Text style={styles.label}>SCHEDULE</Text>
              <View style={styles.chipRow}>
                <Chip label="Now" selected={schedule === 'now'} onPress={() => setSchedule('now')} />
                <Chip label="In 1 hour" selected={schedule === 'hour'} onPress={() => setSchedule('hour')} />
                <Chip label="Tomorrow" selected={schedule === 'tomorrow'} onPress={() => setSchedule('tomorrow')} />
              </View>

              {publishResult && (
                <Text style={publishResult.ok ? styles.successText : styles.errorText}>{publishResult.message}</Text>
              )}

              {publishResult?.ok ? (
                <TouchableOpacity style={styles.primaryBtnWide} onPress={() => { setPublishOpen(false); router.push('/queue'); }}>
                  <Text style={styles.primaryBtnText}>Open Queue</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryBtnWide, (publishing || platforms.length === 0) && styles.btnDisabled]}
                  onPress={publish}
                  disabled={publishing || platforms.length === 0}
                  accessibilityRole="button"
                >
                  {publishing ? <ActivityIndicator color="#000" /> : (
                    <Text style={styles.primaryBtnText}>
                      {platforms.length ? `Queue post to ${platforms.map(platformName).join(', ')}` : 'Select a platform'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  stateTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  stateBody: { color: '#a3a3a3', fontSize: 14, marginBottom: 24, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 10, gap: 16 },
  backBtn: { width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#fff', fontSize: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', flex: 1 },
  tabsContainer: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  tabsScroll: { paddingHorizontal: 20, gap: 24 },
  tabBtn: { paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#66fcf1' },
  tabText: { color: '#737373', fontWeight: 'bold', fontSize: 15 },
  tabTextActive: { color: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  warningBox: { backgroundColor: 'rgba(234,179,8,0.1)', borderColor: 'rgba(234,179,8,0.25)', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16, gap: 4 },
  warningText: { color: '#facc15', fontSize: 12, marginBottom: 8 },
  videoPlayerContainer: { alignItems: 'center', marginBottom: 24 },
  video: { backgroundColor: '#000', borderRadius: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  clipSelector: { marginBottom: 24 },
  sectionTitleSmall: { color: '#fff', fontWeight: 'bold', marginBottom: 12, fontSize: 14 },
  clipThumbnailWrapper: { width: 80, height: 120, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)', position: 'relative' },
  clipThumbnailActive: { borderColor: '#66fcf1' },
  clipThumbnail: { width: '100%', height: '100%' },
  thumbnailFallback: { backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  thumbnailFallbackText: { color: '#555', fontSize: 20 },
  clipScoreBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  clipScoreText: { color: '#facc15', fontSize: 10, fontWeight: 'bold' },
  section: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  sectionDesc: { fontSize: 13, color: '#a3a3a3', marginBottom: 16 },
  reasoning: { fontSize: 13, color: '#d4d4d4', marginBottom: 20, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', gap: 12 },
  primaryBtn: { flex: 1, backgroundColor: '#fff', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  primaryBtnWide: { backgroundColor: '#fff', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', marginTop: 16, alignSelf: 'stretch' },
  primaryBtnText: { color: '#000', fontWeight: 'bold', fontSize: 15, textAlign: 'center' },
  secondaryBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  secondaryBtnWide: { backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', marginTop: 12, alignSelf: 'stretch' },
  secondaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  linkBtn: { alignItems: 'center', paddingTop: 16 },
  label: { color: '#a3a3a3', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8, marginTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  chipActive: { backgroundColor: '#fff', borderColor: '#fff' },
  chipText: { color: '#a3a3a3', fontWeight: 'bold', fontSize: 12 },
  chipTextActive: { color: '#000' },
  preview: { marginVertical: 20, padding: 16, borderRadius: 12, borderWidth: 1, backgroundColor: '#000', alignItems: 'center' },
  errorText: { color: '#f87171', fontSize: 13, marginVertical: 8 },
  successText: { color: '#4ade80', fontSize: 13, marginVertical: 8 },
  input: { backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 14, color: '#fff', fontSize: 14 },
  socialCard: { backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 16, marginBottom: 12 },
  socialHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  socialPlatform: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  copyText: { color: '#66fcf1', fontWeight: 'bold', fontSize: 12 },
  socialTitle: { color: '#fff', fontWeight: 'bold', marginBottom: 4 },
  socialDesc: { color: '#a3a3a3', fontSize: 13, marginBottom: 8 },
  socialHashtags: { color: '#66fcf1', fontWeight: 'bold', fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#0f0f0f', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
});
