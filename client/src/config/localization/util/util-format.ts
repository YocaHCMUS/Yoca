export type NumberFormatInfo = {
  numberNegativePattern: "(n)" | "-n" | "- n" | "n-" | "n -";
  thousandSeparator: string;
  decimalSeparator: string;
  currencySymbol: string;
  currencyNegativePattern:
    | "($n)"
    | "-$n"
    | "$-n"
    | "$n-"
    | "(n$)"
    | "-n$"
    | "n-$"
    | "n$-"
    | "-n $"
    | "-$ n"
    | "n $-"
    | "$ n-"
    | "$ -n"
    | "n- $"
    | "($ n)"
    | "(n $)"
    | "$- n";
  currencyPositivePattern: "$n" | "n$" | "$ n" | "n $";
  percentSymbol: string;
  percentPositivePattern: "n %" | "n%" | "%n" | "% n";
  percentNegativePattern:
    | "-n %"
    | "-n%"
    | "-%n"
    | "%-n"
    | "%n-"
    | "n-%"
    | "n%-"
    | "-% n"
    | "n %-"
    | "% n-"
    | "% -n"
    | "n- %";
  positiveInfititySymbol: string;
  negativeInfititySymbol: string;
  nanSymbol: string;
};

export type DatetimeFormatInfo = {
  datePattern: string;
  timePattern: string;
  dateTimePattern: string;
  utcDateTimePattern: string;
};
