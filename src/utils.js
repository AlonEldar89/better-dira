import { LocalRegistrants, Registrants, Registration } from "./Renderers";

const currencyFormatter = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("he-IL", {
  style: "decimal",
  maximumFractionDigits: 0,
});
export function formatCurrency(number) {
  return currencyFormatter.format(number);
}

export function formatNumber(number) {
  return numberFormatter.format(number);
}

export function getCities(data) {
  const citiesMap = new Map();
  data.forEach((lottery) => {
    const { CityCode, CityDescription } = lottery;
    if (!citiesMap.has(CityCode)) {
      citiesMap.set(CityCode, CityDescription);
    }
  });
  return [...citiesMap.entries()];
}

export function enrichData(rawData, localData) {
  return rawData.map((lottery) => {
    const LocalHousing = localData[parseInt(lottery.LotteryNumber)];
    return {
      ...lottery,
      LocalHousing,
    };
  });
}

export async function fetchNewData({ project, lottery }) {
  const resp = await fetch(
    `https://www.dira.moch.gov.il/api/Invoker?method=Projects&param=%3FfirstApplicantIdentityNumber%3D%26secondApplicantIdentityNumber%3D%26PageNumber%3D1%26PageSize%3D12%26ProjectNumber%3D${project}%26LotteryNumber%3D${lottery}%26`,
    {
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9,he;q=0.8",
        "sec-ch-ua":
          '" Not A;Brand";v="99", "Chromium";v="99", "Google Chrome";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
      },
      body: null,
      method: "GET",
    }
  );
  const json = await resp.json();
  const { TotalLocalSubscribers, TotalSubscribers } =
    json.ProjectItems[0].LotteryStageSummery;
  return {
    TotalLocalSubscribers,
    TotalSubscribers,
  };
}

export async function fetchAllSubscribers(data) {
  const lotteries = data.map((row) => ({
    project: row.ProjectNumber,
    lottery: row.LotteryNumber,
  }));
  const chunksOfSix = lotteries.reduce((acc, cur, i) => {
    if (i % 10 === 0) {
      acc.push([]);
    }
    acc[acc.length - 1].push(cur);
    return acc;
  }, []);
  let res = [];
  for (let i = 0; i < chunksOfSix.length; i++) {
    const lotteries = chunksOfSix[i];
    const result = await Promise.all(
      lotteries.map(async ({ project, lottery }) => {
        const subscribers = await fetchNewData({ project, lottery });
        return [
          lottery,
          {
            _registrants: subscribers.TotalSubscribers,
            _localRegistrants: subscribers.TotalLocalSubscribers,
          },
        ];
      })
    );
    res = res.concat(result);
  }
  return Object.fromEntries(res);
}

export function getColumnDefs() {
  return [
    { field: "LotteryNumber", headerName: "הגרלה", minWidth: 85, maxWidth: 85 },
    { field: "ProjectNumber", headerName: "מתחם", minWidth: 85, maxWidth: 85 },
    {
      field: "CityDescription",
      headerName: "עיר",
      minWidth: 120,
      maxWidth: 120,
      filter: "agTextColumnFilter",
    },
    {
      field: "ProjectName",
      headerName: "פרויקט",
      maxWidth: 200,
      resizable: true,
      minWidth: 90,
    },
    {
      field: "ContractorDescription",
      headerName: "קבלן",
      maxWidth: 300,
      resizable: true,
      minWidth: 90,
    },
    {
      field: "PricePerUnit",
      headerName: 'מחיר למ"ר',
      minWidth: 120,
      maxWidth: 120,
      cellRenderer: (params) => formatCurrency(params.data.PricePerUnit),
    },
    {
      field: "GrantSize",
      headerName: "מענק",
      minWidth: 120,
      maxWidth: 120,
      cellRenderer: (params) => formatCurrency(params.data.GrantSize),
    },

    {
      field: "LotteryApparmentsNum",
      headerName: "דירות",
      minWidth: 100,
      maxWidth: 100,
    },
    {
      field: "LocalHousing",
      headerName: "לבני מקום",
      minWidth: 110,
      maxWidth: 110,
    },
    {
      cellRenderer: Registrants,
      headerName: "נרשמו",
      minWidth: 90,
      maxWidth: 90,
      field: "_registrants",
    },
    {
      cellRenderer: LocalRegistrants,
      headerName: "בני מקום",
      minWidth: 110,
      maxWidth: 110,
      field: "_localRegistrants",
    },

    {
      cellRenderer: Registration,
      minWidth: 150,
      maxWidth: 150,
      sortable: false,
      resizable: false,
    },
  ];
}
//example of odds calculation for project #1943
//Assuming a local is participating twice, once in a local only raffle
//2nd time in the general public raffle
//this assumptions comes from this link:
//https://www.gov.il/he/departments/faq/faq_dira
//assuming all disabled apts are taken from non-locals.
export function calculateOddsforLocal() {
  const apartments = 102
  const localAprartments = 51
  const disabledApts = 3
  const totalRegs= 3526
  const localRegs= 438
  const localRaffleOdds= localAprartments/localRegs
  const generalRaffleOddsForLocals= (apartments-localAprartments-disabledApts)/(totalRegs-localAprartments)
  const accumulatedlocalOdds= localRaffleOdds + (1-localRaffleOdds)*generalRaffleOddsForLocals
  return accumulatedlocalOdds*100 //times 100 for % and not odds.
}

//odds for general public are more intuitive
//assumption here is that all local apartments were given away to locals
export function caluclateOddsforGeneral() {
  const apartments = 102
  const localAprartments = 51
  const disabledApts = 3
  const totalRegs= 3526
  //apartments left after local distribution / total registrations- local apts. won in local raffle.
  const oddsForGeneral= (apartments-disabledApts-localAprartments)/(totalRegs-localAprartments)
  return oddsForGeneral*100 //times 100 for% and not odds.
}

