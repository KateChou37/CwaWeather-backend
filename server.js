require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// CWA API 設定
const CWA_API_BASE_URL = "https://opendata.cwa.gov.tw/api";
const CWA_API_KEY = process.env.CWA_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * 取得指定地區的天氣預報工廠函式
 * 使用 CWA 一般天氣預報（今明36小時）資料集 F-C0032-001
 */
const getCityWeather = (locationName) => {
  return async (req, res) => {
    try {
      // 檢查是否有設定 API Key
      if (!CWA_API_KEY) {
        return res.status(500).json({
          error: "伺服器設定錯誤",
          message: "請在 .env 檔案中設定 CWA_API_KEY",
        });
      }

      // 呼叫 CWA API - 一般天氣預報（36小時）
      // API 文件: https://opendata.cwa.gov.tw/dist/opendata-swagger.html
      const response = await axios.get(
        `${CWA_API_BASE_URL}/v1/rest/datastore/F-C0032-001`,
        {
          params: {
            Authorization: CWA_API_KEY,
          },
        }
      );

      const locations = response.data.records && response.data.records.location;
      const locationData = Array.isArray(locations)
        ? locations.find((l) => l.locationName === locationName)
        : null;

      if (!locationData) {
        return res.status(404).json({
          error: "查無資料",
          message: `無法取得 ${locationName} 天氣資料`,
        });
      }

      // 整理天氣資料
      const weatherData = {
        city: locationData.locationName,
        updateTime: response.data.records.datasetDescription,
        forecasts: [],
      };

      // 解析天氣要素
      const weatherElements = locationData.weatherElement;
      const timeCount = weatherElements[0].time.length;

      for (let i = 0; i < timeCount; i++) {
        const forecast = {
          startTime: weatherElements[0].time[i].startTime,
          endTime: weatherElements[0].time[i].endTime,
          weather: "",
          rain: "",
          minTemp: "",
          maxTemp: "",
          comfort: "",
          windSpeed: "",
        };

        weatherElements.forEach((element) => {
          const value = element.time[i].parameter;
          switch (element.elementName) {
            case "Wx":
              forecast.weather = value.parameterName;
              break;
            case "PoP":
              forecast.rain = value.parameterName + "%";
              break;
            case "MinT":
              forecast.minTemp = value.parameterName + "°C";
              break;
            case "MaxT":
              forecast.maxTemp = value.parameterName + "°C";
              break;
            case "CI":
              forecast.comfort = value.parameterName;
              break;
            case "WS":
              forecast.windSpeed = value.parameterName;
              break;
          }
        });

        weatherData.forecasts.push(forecast);
      }

      res.json({
        success: true,
        data: weatherData,
      });
    } catch (error) {
      console.error("取得天氣資料失敗:", error.message);

      if (error.response) {
        // API 回應錯誤
        return res.status(error.response.status).json({
          error: "CWA API 錯誤",
          message: error.response.data.message || "無法取得天氣資料",
          details: error.response.data,
        });
      }

      // 其他錯誤
      res.status(500).json({
        error: "伺服器錯誤",
        message: "無法取得天氣資料，請稍後再試",
      });
    }
  };
};
;

// 為需要的城市建立 handler
const getTaipeiWeather = getCityWeather("台北市");
const getTaichungWeather = getCityWeather("台中市");
const getChanghuaWeather = getCityWeather("彰化縣");
const getKaohsiungWeather = getCityWeather("高雄市");
const getYilanWeather = getCityWeather("宜蘭縣");

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "歡迎使用 CWA 天氣預報 API",
    endpoints: {
      taipei: "/api/weather/taipei",
      taichung: "/api/weather/taichung",
      changhua: "/api/weather/changhua",
      kaohsiung: "/api/weather/kaohsiung",
      yilan: "/api/weather/yilan",
      health: "/api/health",
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// 取得台北天氣預報
app.get("/api/weather/taipei", getTaipeiWeather);
// 取得台中天氣預報
app.get("/api/weather/taichung", getTaichungWeather);
// 取得彰化天氣預報
app.get("/api/weather/changhua", getChanghuaWeather);
// 取得高雄天氣預報
app.get("/api/weather/kaohsiung", getKaohsiungWeather);
// 取得宜蘭天氣預報
app.get("/api/weather/yilan", getYilanWeather);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "伺服器錯誤",
    message: err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "找不到此路徑",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 伺服器運行已運作`);
  console.log(`📍 環境: ${process.env.NODE_ENV || "development"}`);
});
