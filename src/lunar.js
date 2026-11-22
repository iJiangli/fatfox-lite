/* lunar.js — 农历换算（1900–2100），离线纯计算，无依赖。
   数据表 YEAR_INFOS 与经典 lunar 算法一致：
   - 低 4 位：闰月月份（0 表示无闰月）
   - 其余位：12 或 13 个月的月大/月小标记，逐月右移
   参考实现为 lunardate（GPLv2 表数据，算法另行改写）。 */
(function (global) {
  'use strict';

  var START_YEAR = 1900;

  var YEAR_INFOS = [
    19416, 19168, 42352, 21717, 53856, 55632, 91476, 22176, 39632, 21970,
    19168, 42422, 42192, 53840, 119381, 46400, 54944, 44450, 38320, 84343,
    18800, 42160, 46261, 27216, 27968, 109396, 11104, 38256, 21234, 18800,
    25958, 54432, 59984, 28309, 23248, 11104, 100067, 37600, 116951, 51536,
    54432, 120998, 46416, 22176, 107956, 9680, 37584, 53938, 43344, 46423,
    27808, 46416, 86869, 19872, 42448, 83315, 21168, 43432, 59728, 27296,
    44710, 43856, 19296, 43748, 42352, 21088, 62051, 55632, 23383, 22176,
    38608, 19925, 19152, 42192, 54484, 53840, 54616, 46400, 46496, 103846,
    38320, 18864, 43380, 42160, 45690, 27216, 27968, 44870, 43872, 38256,
    19189, 18800, 25776, 29859, 59984, 27480, 23232, 43872, 38613, 37600,
    51552, 55636, 54432, 55888, 30034, 22176, 43959, 9680, 37584, 51893,
    43344, 46240, 47780, 44368, 21977, 19360, 42416, 86390, 21168, 43312,
    31060, 27296, 44368, 23378, 19296, 42726, 42208, 53856, 60005, 54576,
    23200, 30371, 38608, 19195, 19152, 42192, 118966, 53840, 54560, 56645,
    46496, 22224, 21938, 18864, 42359, 42160, 43600, 111189, 27936, 44448,
    84835, 37744, 18936, 18800, 25776, 92326, 59984, 27296, 108228, 43744,
    37600, 53987, 51552, 54615, 54432, 55888, 23893, 22176, 42704, 21972,
    21200, 43448, 43344, 46240, 46758, 44368, 21920, 43940, 42416, 21168,
    45683, 26928, 29495, 27296, 44368, 84821, 19296, 42352, 21732, 53600,
    59752, 54560, 55968, 92838, 22224, 19168, 43476, 41680, 53584, 62034
  ];

  var LUNAR_MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
  var LUNAR_DAY_TENS = ['初', '十', '廿', '卅'];
  var LUNAR_DAY_UNITS = ['十', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  var STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  var ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  var WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

  /** 某农历年的总天数 */
  function yearDays(year) {
    var info = YEAR_INFOS[year - START_YEAR];
    var sum = 348; // 12 * 29
    for (var bit = 0x8000; bit > 0x8; bit >>= 1) {
      if (info & bit) sum += 1;
    }
    return sum + leapDays(year);
  }

  /** 闰月天数，无闰月返回 0 */
  function leapDays(year) {
    var info = YEAR_INFOS[year - START_YEAR];
    if (leapMonthRaw(year) === 0) return 0;
    return (info & 0x10000) ? 30 : 29;
  }

  /** 原始闰月值：低 4 位，可能为 0..15；>12 视为无闰月 */
  function leapMonthRaw(year) {
    return YEAR_INFOS[year - START_YEAR] & 0xf;
  }

  /** 闰月月份，无闰月返回 0 */
  function leapMonth(year) {
    var raw = leapMonthRaw(year);
    return raw > 0 && raw <= 12 ? raw : 0;
  }

  /** 某农历年某月（不区分闰）的天数 */
  function monthDays(year, month) {
    var info = YEAR_INFOS[year - START_YEAR];
    return (info & (0x10000 >> month)) ? 30 : 29;
  }

  /** 1900-01-31 为农历 1900 年正月初一 */
  var BASE = new Date(1900, 0, 31);
  var MS_PER_DAY = 86400000;

  function dateToUTC(date) {
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function baseUTC() {
    return Date.UTC(1900, 0, 31);
  }

  /**
   * 公历 → 农历
   * @param {Date} date
   * @returns {{year:number, month:number, day:number, isLeap:boolean, monthName:string, dayName:string, yearName:string, zodiac:string}}
   */
  function solarToLunar(date) {
    var offset = Math.floor((dateToUTC(date) - baseUTC()) / MS_PER_DAY);
    if (offset < -1 || offset > 73000) {
      return null;
    }
    // 1900 年之前的正月初一
    var year = START_YEAR;
    var remain = offset;
    var yDays;
    while (year < START_YEAR + YEAR_INFOS.length) {
      yDays = yearDays(year);
      if (remain < yDays) break;
      remain -= yDays;
      year += 1;
    }
    var lm = leapMonth(year);
    // 逐月展开成有序表：正..腊，闰月在对应的月份之后插入
    var months = [];
    for (var m = 1; m <= 12; m++) {
      months.push({ month: m, leap: false, days: monthDays(year, m) });
      if (lm === m) {
        months.push({ month: m, leap: true, days: leapDays(year) });
      }
    }
    var picked = months[months.length - 1];
    for (var idx = 0; idx < months.length; idx++) {
      if (remain < months[idx].days) {
        picked = months[idx];
        break;
      }
      remain -= months[idx].days;
    }
    var month = picked.month;
    var isLeap = picked.leap;
    var day = remain + 1;

    return {
      year: year,
      month: month,
      day: day,
      isLeap: isLeap,
      monthName: makeMonthName(month, isLeap),
      dayName: makeDayName(day),
      yearName: makeYearName(year),
      zodiac: ZODIAC[(year - 4) % 12]
    };
  }

  function makeMonthName(month, isLeap) {
    var name = LUNAR_MONTH_NAMES[month - 1] + '月';
    return isLeap ? '闰' + name : name;
  }

  function makeDayName(day) {
    if (day === 10) return '初十';
    if (day === 20) return '二十';
    if (day === 30) return '三十';
    var tens = Math.floor(day / 10);
    var unit = day % 10;
    if (tens === 0) return '初' + LUNAR_DAY_UNITS[unit];
    if (tens === 1) return '十' + (unit === 0 ? '' : LUNAR_DAY_UNITS[unit]);
    if (tens === 2) return '廿' + (unit === 0 ? '' : LUNAR_DAY_UNITS[unit]);
    return '三' + LUNAR_DAY_UNITS[unit];
  }

  function makeYearName(year) {
    var i = (year - 4) % 60;
    if (i < 0) i += 60;
    return STEMS[i % 10] + BRANCHES[i % 12];
  }

  global.Lunar = {
    solarToLunar: solarToLunar,
    weekdays: WEEKDAYS,
    lunarDateText: function (date) {
      var l = solarToLunar(date);
      if (!l) return '';
      return l.monthName + l.dayName;
    },
    /** 常见节日（阳历 / 农历） */
    festivalOf: function (date) {
      var m = date.getMonth() + 1;
      var d = date.getDate();
      var solar = {
        '1-1': '元旦', '2-14': '情人节', '3-8': '妇女节', '3-12': '植树节',
        '4-1': '愚人节', '5-1': '劳动节', '5-4': '青年节', '6-1': '儿童节',
        '7-1': '建党节', '8-1': '建军节', '9-10': '教师节', '10-1': '国庆节',
        '12-24': '平安夜', '12-25': '圣诞节'
      };
      var key = m + '-' + d;
      if (solar[key]) return solar[key];
      var l = solarToLunar(date);
      if (!l) return '';
      var lunar = {
        '1-1': '春节', '1-15': '元宵节', '2-2': '龙抬头', '5-5': '端午节',
        '7-7': '七夕', '7-15': '中元节', '8-15': '中秋节', '9-9': '重阳节',
        '12-8': '腊八节', '12-23': '小年'
      };
      if (!l.isLeap && lunar[l.month + '-' + l.day]) return lunar[l.month + '-' + l.day];
      // 除夕：农历十二月最后一天
      if (!l.isLeap && l.month === 12) {
        var total = monthDays(l.year, 12);
        if (l.day === total) return '除夕';
      }
      return '';
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
