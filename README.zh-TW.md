# Slots

[English](README.md)

[安裝](#安裝) • [Preset](#preset) • [設定](#設定) • [LLM 政策](#llm-政策)

![Supports GNOME Shell 46](https://img.shields.io/badge/Supports-GNOME_Shell_46-blueviolet.svg?style=flat-square&logo=gnome&logoColor=white)

在 GNOME 面板左側放最多五顆按鈕，並在 Activities 右側以粗體顯示前景應用程式的名稱。每一顆按鈕只做一件事：開啟應用程式、開啟網站，或開啟應用程式總覽。

![Slots](preview.png)

---

### 目錄

- [介紹](#介紹)
- [功能](#功能)
- [需求](#需求)
- [安裝](#安裝)
- [Preset](#preset)
- [設定](#設定)
- [LLM 政策](#llm-政策)

# 介紹

面板上本來就放得下幾個字。Activities 是一個。有安裝的話，Apps 和 Places 也是。Slots 是同一種按鈕，最多五顆，標題和動作都由你決定。點下去，就做那顆按鈕被指定的事。

預設行為來自三個想法：

+ **一顆按鈕，一件事。** 開啟應用程式、開啟網址，或開啟應用程式總覽。點擊後面沒有別的功能。
+ **顯示正在使用的程式。** 前景應用程式的名稱以粗體出現在 Activities 右側，捷徑按鈕排在名稱後面。
+ **留在你已經有的面板上。** Activities 維持 GNOME 原本的位置。Apps Menu 和 Places 裝或不裝都可以，Slots 不會去找它們。

UUID：`slots@jettakarn`。

# 功能

- 面板左側最多五顆獨立按鈕，排在前景應用程式名稱的後面。
- 三種動作：已安裝的應用程式、用預設瀏覽器開啟的網站，或應用程式總覽。
- 前景應用程式的名稱以粗體顯示在 Activities 右側。它只是標籤。沒有前景視窗時，只留下捷徑按鈕。桌面也一樣，不會顯示名稱。
- 兩種 preset：Default 和 macOS。改過任何一顆按鈕之後，會變成 Custom。
- 標題可以自己寫。留空時，按鈕會用應用程式名稱、網站的主機名稱，或「Apps」。
- 可以只顯示文字、只顯示圖示，或兩者都顯示。圖示名稱留空時，會用應用程式自己的圖示；網站用瀏覽器圖示；Show Applications 用應用程式總覽的圖示。
- 設定視窗有兩頁：Buttons，然後是 About。

# 需求

- GNOME Shell 46
- 已啟用使用者擴充功能（一般 GNOME 工作階段的預設就是這樣）

# 安裝

```sh
git clone https://github.com/jettakarn/slots.git
cd slots
mkdir -p ~/.local/share/gnome-shell/extensions
ln -sfn "$(pwd)" ~/.local/share/gnome-shell/extensions/slots@jettakarn
glib-compile-schemas ~/.local/share/gnome-shell/extensions/slots@jettakarn/schemas
gnome-extensions enable slots@jettakarn
```

在 Wayland 上，先登出再登入一次，Shell 才看得到這個新擴充功能。之後停用再啟用 Slots，就可以載入程式變更。

打開 **Extensions**，選擇 **Slots**，在那裡設定按鈕。變更會直接出現在面板上，不必再登入一次。

# Preset

前景應用程式的名稱和 preset 是分開的。名稱以粗體出現在 Activities 右側，preset 的按鈕接在後面。選擇一個 preset 會換掉全部五顆按鈕。**Reset** 會再套用一次目前的 preset。改過任何一顆按鈕，preset 會變成 **Custom**。

**Default** 會打開三顆文字按鈕：

- **Terminal** 開啟終端機
- **Files** 開啟檔案總管
- **Browser** 開啟預設的網頁瀏覽器

另外兩顆維持關閉。

**macOS** 會打開五顆文字按鈕：

- **Files** 開啟檔案總管
- **Apps** 開啟應用程式總覽
- **Browser** 開啟預設的網頁瀏覽器
- **Mail** 開啟預設的郵件程式（`mailto`）
- **Settings** 開啟設定

如果系統上沒有程式處理 `mailto`，Mail 會留在清單裡並顯示未安裝，面板上也不會出現，直到你為它選一個應用程式。

Default 的終端機、檔案總管和瀏覽器，在原本的 desktop 檔不存在時，會改找已安裝的對應程式。選過的應用程式若已被移除，那顆按鈕會先隱藏，直到你再選一個。

# 設定

設定視窗有兩頁。**Buttons** 是實際會用到的那一頁。**About** 是名稱、版本、UUID、支援的 Shell 版本，以及儲存庫連結。

在 **Buttons**：

- **Preset** 是 Default、macOS 或 Custom。**Reset** 會把選中的 Default 或 macOS 再寫回去。
- 每一顆面板按鈕是一列。列上的開關決定顯示或隱藏。展開該列才能編輯。
- **Title** 是按鈕上的文字。
- **Type**
  - **Application。** 選擇一個已安裝的應用程式。點擊會開啟它；若已經在執行，則把視窗帶到前面。
  - **Website。** 輸入網址。沒有寫協定時會補上 `https://`。
  - **Show Applications。** 開啟應用程式總覽。
- **Label style** 是 Text、Icon，或 Text and icon。
- **Icon name** 會覆寫自動選用的圖示。例如 `utilities-terminal-symbolic`。只有標籤樣式包含圖示時才會顯示。

# LLM 政策

這個儲存庫是用 AI 開發的。擴充功能、preset，以及這份 README，都是由 AI 程式助手撰寫，再由維護者審閱後留下。

用 AI 協助的貢獻可以。請在 pull request 裡說明，把變更保持在審得完的大小，並自己回答相關問題。
