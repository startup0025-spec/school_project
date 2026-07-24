import React, { useState, useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NOTIFICATION_STORAGE_KEY } from '@/lib/services/notification_service';

interface AppNotification {
  id: string;
  time: string;
  text: string;
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY)
      .then((data) => {
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              setNotifications(parsed);
            }
          } catch (e) {
            console.warn('[NotificationsScreen] 파싱 실패:', e);
          }
        }
      })
      .catch((e) => console.warn('[NotificationsScreen] 로드 에러:', e));
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        scrollEnabled={notifications.length > 0}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>아직 도착한 알림이 없습니다.</Text>
          </View>
        }
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.item, { borderBottomColor: colors.border }]}>
            <View style={[styles.itemIconWrap, { backgroundColor: colors.secondary }]}>
              <Feather name="feather" size={13} color={colors.primary} />
            </View>
            <View style={styles.itemBody}>
              <Text style={[styles.itemTime, { color: colors.mutedForeground }]}>{item.time}</Text>
              <Text style={[styles.itemText, { color: colors.foreground }]}>{item.text}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  item: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  itemIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
  },
  itemTime: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginBottom: 4,
  },
  itemText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
});
