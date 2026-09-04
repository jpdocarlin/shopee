import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
};

export function DateRangePicker({ value, onChange }: Props) {
  const [internal, setInternal] = useState<DateRange | undefined>(value);
  const range = value ?? internal;

  const handleChange = (next: DateRange | undefined) => {
    setInternal(next);
    onChange?.(next);
  };

  const label = range?.from
    ? range.to
      ? `${format(range.from, "dd MMM", { locale: ptBR })} – ${format(range.to, "dd MMM", { locale: ptBR })}`
      : format(range.from, "dd MMM yyyy", { locale: ptBR })
    : "Selecionar período";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2 text-[13px]">
          <CalendarDays className="size-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={range}
          onSelect={handleChange}
          locale={ptBR}
        />
      </PopoverContent>
    </Popover>
  );
}
