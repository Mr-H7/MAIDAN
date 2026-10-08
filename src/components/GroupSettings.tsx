import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Group } from "../lib/types";
import { db } from "../lib/supabase";
import { ActionButton } from "./ui/ActionButton";
import { Card } from "./ui/Card";
import { useApp } from "../context/AppContext";
export function GroupSettings({ group }: { group: Group }) {
  const { language } = useApp();
  const ar = language === "ar";
  const client = useQueryClient();
  const [timezone, setTimezone] = useState(group.timezone);
  const [capacity, setCapacity] = useState(group.capacity);
  const [windowHours, setWindowHours] = useState(group.rating_window_hours);
  const [hatTrick, setHatTrick] = useState(group.green_hat_trick_enabled);
  const [redemption, setRedemption] = useState(group.green_redemption_enabled);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const save = async () => {
    setBusy(true);
    const { error } = await db().rpc("update_group_settings", {
      p_group_id: group.id,
      p_timezone: timezone,
      p_capacity: capacity,
      p_rating_window_hours: windowHours,
      p_green_hat_trick_enabled: hatTrick,
      p_green_redemption_enabled: redemption,
    });
    setBusy(false);
    if (error) setNotice(error.message);
    else {
      setNotice(ar ? "حُفظت إعدادات المجموعة." : "Group settings saved.");
      client.invalidateQueries({ queryKey: ["memberships"] });
    }
  };
  return (
    <Card>
      <h2 className="section-title">
        {ar ? "إعدادات المجموعة" : "Group settings"}
      </h2>
      <div className="form-stack">
        <label className="field">
          {ar ? "المنطقة الزمنية" : "Timezone"}
          <input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="Africa/Cairo"
          />
        </label>
        <label className="field">
          {ar ? "سعة الجمعة" : "Friday capacity"}
          <input
            type="number"
            min="2"
            max="100"
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
          />
        </label>
        <label className="field">
          {ar ? "مدة التقييم (بالساعات)" : "Rating window (hours)"}
          <input
            type="number"
            min="1"
            max="168"
            value={windowHours}
            onChange={(e) => setWindowHours(Number(e.target.value))}
          />
        </label>
        <label className="row-start">
          <input
            type="checkbox"
            checked={hatTrick}
            onChange={(e) => setHatTrick(e.target.checked)}
          />{" "}
          {ar
            ? "منح بطاقة خضراء لهاتريك"
            : "Award a green card for a hat-trick"}
        </label>
        <label className="row-start">
          <input
            type="checkbox"
            checked={redemption}
            onChange={(e) => setRedemption(e.target.checked)}
          />{" "}
          {ar
            ? "السماح للمشرف باستبدال بطاقة خضراء مقابل حمراء"
            : "Allow admin approved green card redemption for a red card"}
        </label>
        <ActionButton
          disabled={
            busy ||
            !timezone.trim() ||
            capacity < 2 ||
            capacity > 100 ||
            windowHours < 1 ||
            windowHours > 168
          }
          onClick={save}
        >
          {ar ? "حفظ الإعدادات" : "Save settings"}
        </ActionButton>
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
      </div>
    </Card>
  );
}
