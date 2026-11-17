
/**
 * YouTube複数再生リスト一括置換ツール
 *
 * 使い方：
 * 1. 下の設定を書き換える
 * 2. testMultiplePlaylistReplacement() で確認
 * 3. 問題なければ EXECUTE = true に変更
 * 4. replaceMultiplePlaylistVideos() を実行
 *
 * YouTube Data API v3 の拡張サービスが必要
 */

// ===================================
// 設定：ここを書き換える
// ===================================

const REPLACE_CONFIG = {

  // 対象の再生リストID（複数指定）
  PLAYLIST_IDS: [
    "再生リストID_1",
    "再生リストID_2",
    "再生リストID_3",
    "再生リストID_4"
  ],

  // 置き換え後の新動画ID
  NEW_VIDEO_ID: "新動画ID",

  // 置き換えたい旧動画ID
  OLD_VIDEO_IDS: [
    "旧動画ID"
  ],

  // false：確認のみ
  // true：実際に置き換える
  EXECUTE: true

};


// ===================================
// テスト：対象動画を確認する
// ===================================

function testMultiplePlaylistReplacement() {

  const config = REPLACE_CONFIG;
  validateMultipleConfig_(config);

  for (const playlistId of config.PLAYLIST_IDS) {

    Logger.log("================================");
    Logger.log("再生リストID：" + playlistId);

    try {

      const items = getAllMultiplePlaylistItems_(playlistId);
      const oldIds = new Set(config.OLD_VIDEO_IDS);

      const targets = items.filter(item =>
        oldIds.has(item.snippet.resourceId.videoId)
      );

      Logger.log("動画総数：" + items.length);
      Logger.log("置換対象件数：" + targets.length);

      targets.forEach(item => {
        Logger.log(
          "位置：" + item.snippet.position +
          " | " + item.snippet.title
        );
      });

    } catch (error) {

      Logger.log(
        "確認失敗：" + String(error.message || error)
      );

    }
  }

  Logger.log("テスト確認終了");

}


// ===================================
// 複数再生リストを一括置換する
// ===================================

function replaceMultiplePlaylistVideos() {

  const config = REPLACE_CONFIG;
  validateMultipleConfig_(config);

  if (!config.EXECUTE) {
    throw new Error(
      "実行停止中です。EXECUTE を true にしてください。"
    );
  }

  const oldIds = new Set(config.OLD_VIDEO_IDS);

  if (oldIds.has(config.NEW_VIDEO_ID)) {
    throw new Error("新動画IDと旧動画IDが同じです。");
  }

  let totalSuccess = 0;
  let totalFailed = 0;

  for (const playlistId of config.PLAYLIST_IDS) {

    Logger.log("================================");
    Logger.log("処理開始：" + playlistId);

    let success = 0;
    let failed = 0;

    try {

      const items = getAllMultiplePlaylistItems_(playlistId);

      const targets = items.filter(item =>
        oldIds.has(item.snippet.resourceId.videoId)
      );

      // 後ろの位置から処理する
      targets.sort((a, b) =>
        b.snippet.position - a.snippet.position
      );

      Logger.log("動画総数：" + items.length);
      Logger.log("置換対象件数：" + targets.length);

      if (targets.length === 0) {
        Logger.log("置換対象なし。次のリストへ進みます。");
        continue;
      }

      for (const target of targets) {

        const position = target.snippet.position;
        let insertedId = null;

        try {

          // 対象項目がまだ旧動画か確認
          const current = YouTube.PlaylistItems.list(
            "snippet",
            { id: target.id }
          );

          if (
            !current.items ||
            current.items.length === 0 ||
            current.items[0].snippet.resourceId.videoId !==
              target.snippet.resourceId.videoId
          ) {
            throw new Error("対象動画を確認できません。");
          }

          // 新動画を元の位置に追加
          const inserted = YouTube.PlaylistItems.insert(
            {
              snippet: {
                playlistId: playlistId,
                position: position,
                resourceId: {
                  kind: "youtube#video",
                  videoId: config.NEW_VIDEO_ID
                }
              }
            },
            "snippet"
          );

          insertedId = inserted.id;

          // 追加結果を確認
          if (
            !insertedId ||
            !inserted.snippet ||
            !inserted.snippet.resourceId ||
            inserted.snippet.resourceId.videoId !==
              config.NEW_VIDEO_ID
          ) {
            throw new Error(
              "新動画の追加を確認できません。旧動画は削除していません。"
            );
          }

          // 新動画の追加成功後に旧動画を削除
          YouTube.PlaylistItems.remove(target.id);

          success++;

          Logger.log(
            "成功 | 位置：" + position +
            " | 新動画追加・旧動画削除完了"
          );

        } catch (error) {

          failed++;

          Logger.log(
            "失敗 | 位置：" + position +
            " | 旧項目ID：" + target.id +
            " | 新項目ID：" + (insertedId || "未取得") +
            " | エラー：" + String(error.message || error)
          );

        }

      }

    } catch (error) {

      failed++;

      Logger.log(
        "再生リスト処理失敗：" +
        String(error.message || error)
      );

    }

    totalSuccess += success;
    totalFailed += failed;

    Logger.log(
      "リスト処理終了 | 成功：" + success +
      " | 失敗：" + failed
    );

  }

  Logger.log("================================");
  Logger.log(
    "全リスト処理終了 | 成功：" + totalSuccess +
    " | 失敗：" + totalFailed
  );

}


// ===================================
// 再生リスト全体を取得
// ===================================

function getAllMultiplePlaylistItems_(playlistId) {

  const all = [];
  let pageToken;

  do {

    const params = {
      playlistId: playlistId,
      maxResults: 50
    };

    if (pageToken) {
      params.pageToken = pageToken;
    }

    const response = YouTube.PlaylistItems.list(
      "snippet",
      params
    );

    all.push(...(response.items || []));
    pageToken = response.nextPageToken;

  } while (pageToken);

  return all;

}


// ===================================
// 設定内容をチェック
// ===================================

function validateMultipleConfig_(config) {

  if (
    !Array.isArray(config.PLAYLIST_IDS) ||
    config.PLAYLIST_IDS.length === 0 ||
    config.PLAYLIST_IDS.some(id =>
      !id || id.includes("再生リストID")
    )
  ) {
    throw new Error("PLAYLIST_IDS を設定してください。");
  }

  if (
    new Set(config.PLAYLIST_IDS).size !==
    config.PLAYLIST_IDS.length
  ) {
    throw new Error("再生リストIDが重複しています。");
  }

  if (
    !config.NEW_VIDEO_ID ||
    config.NEW_VIDEO_ID === "新動画ID"
  ) {
    throw new Error("NEW_VIDEO_ID を設定してください。");
  }

  if (
    !Array.isArray(config.OLD_VIDEO_IDS) ||
    config.OLD_VIDEO_IDS.length === 0 ||
    config.OLD_VIDEO_IDS.some(id =>
      !id || id === "旧動画ID"
    )
  ) {
    throw new Error("OLD_VIDEO_IDS を設定してください。");
