# Slots

Slots 在 GNOME 的 panel 左側放最多三顆獨立按鈕。每一顆只做一件事：開啟一個已安裝的應用程式，或用預設瀏覽器打開一個網址。按鈕上的文字由你自己填，跟 extension 的名稱分開。

UUID：`slots@jettakarn`。支援 GNOME Shell 46。

## 使用

登入後，左側會先出現兩顆按鈕：

- **Terminal**：開啟終端機
- **Files**：開啟檔案總管

第三格預設關閉。點左鍵就執行那一格的動作。按鈕排在左側現有項目的後面，有沒有安裝 Apps Menu 或 Places 都不影響。

自訂在 extension 的設定裡。打開 Extensions，選 Slots 的設定。三格各自有這些欄位：

- **Enabled**：關掉的格子不會出現在 panel 上
- **Title**：按鈕上的文字。留空時，開 app 會改顯示應用程式名稱，開網址會改顯示網址的主機名
- **Icon name**：可留空。留空就只顯示標題。要圖示時填圖示名稱，例如 `utilities-terminal-symbolic`
- **Type**
  - **Application**：按 Choose，從已安裝的應用程式裡選一個。再點按鈕會打開它；若已經在跑，就把那個視窗帶到前面
  - **Website**：填網址。沒寫 `http://` 或 `https://` 時，會補上 `https://`

選好的應用程式若之後被移除，那一顆按鈕會先隱藏，直到你在設定裡重選。預設的 Terminal 和 Files 在對應的 `.desktop` 不存在時，會改找這台電腦上已安裝的終端機或檔案總管。

改完設定後，panel 上的按鈕會立刻更新，不用重新登入。

## 安裝

```bash
mkdir -p ~/.local/share/gnome-shell/extensions
ln -sfn "$(pwd)" ~/.local/share/gnome-shell/extensions/slots@jettakarn
glib-compile-schemas ~/.local/share/gnome-shell/extensions/slots@jettakarn/schemas
gnome-extensions enable slots@jettakarn
```

Wayland 上，新裝的 extension 要登出再登入才會出現在 panel。之後若只是改程式，停用再啟用即可。
