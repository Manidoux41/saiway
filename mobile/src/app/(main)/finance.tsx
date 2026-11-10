import { useLanguage } from '@/providers/language';
import { useRef, useState } from 'react';
import { Redirect } from 'expo-router';
import { Switch, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { z } from 'zod';
import { useSession } from '@/providers/session';
import { useApi, useOperation } from '@/hooks/use-api';
import { client } from '@/lib/api';
import { expensesSchema, payrollsSchema } from '@/lib/contracts';
import { cents } from '@/lib/policy';
import { sharePdf } from '@/lib/native-files';
import { Button, Card, Choices, Field, Loading, Notice, Page, styles } from '@/components/native-ui';

const expenseCreatedSchema = z.object({ expense: z.object({ id: z.string() }), duplicate: z.boolean() });
export default function Finance() {
  const { t, money, dateTime } = useLanguage();
  const { user } = useSession();
  const driver = user?.role === 'driver';
  const expenses = useApi(driver ? '/api/driver/vehicle-expenses' : null, expensesSchema);
  const payrolls = useApi(driver ? '/api/driver/payroll' : null, payrollsSchema);
  const operation = useOperation();
  const [section, setSection] = useState('fuel');
  const [vehicleId, setVehicleId] = useState('');
  const [odometer, setOdometer] = useState('');
  const [liters, setLiters] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [rate, setRate] = useState('');
  const [fullTank, setFullTank] = useState(false);
  const [notes, setNotes] = useState('');
  const [occurredAt, setOccurredAt] = useState(() => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 16));
  const submission = useRef<{ key: string; requestId: string } | null>(null);
  if (!driver) return <Redirect href="/(main)/trips" />;
  function submit() {
    void operation.run(async () => {
      if (!vehicleId) throw new Error(t("Choisissez un véhicule."));
      const odometerKm = odometer.trim().replace(',', '.');
      const volume = liters.trim().replace(',', '.');
      if (!/^\d+(\.\d)?$/.test(odometerKm) || !/^\d+(\.\d{1,3})?$/.test(volume) || Number(volume) <= 0) {
        throw new Error(t("Kilométrage : 1 décimale maximum. Litres : valeur positive, 3 décimales maximum."));
      }
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(occurredAt) || !Number.isFinite(Date.parse(`${occurredAt}:00+07:00`))) throw new Error(t("Date invalide."));
      const body = {
        vehicleId, occurredAt: `${occurredAt}:00+07:00`, odometerKm, liters: volume,
        amountCents: cents(amount), currency, khrPerUsd: currency === 'KHR' ? rate.trim().replace(',', '.') : null,
        fullTank, notes: notes.trim() || null,
      };
      if (body.amountCents <= 0 || Date.parse(body.occurredAt) > Date.now()) throw new Error(t("Montant positif et date non future requis."));
      const key = JSON.stringify(body);
      if (submission.current?.key !== key) submission.current = { key, requestId: Crypto.randomUUID() };
      await client().request('/api/driver/vehicle-expenses', expenseCreatedSchema, {
        method: 'POST', body: { ...body, requestId: submission.current.requestId },
      });
      submission.current = null; setAmount(''); setLiters(''); setNotes(''); expenses.refresh();
    }, t("Dépense transmise pour validation."));
  }
  return <Page title={t("Mes finances")} refreshing={expenses.loading || payrolls.loading} onRefresh={() => { expenses.refresh(); payrolls.refresh(); }}>
    <Choices value={section} onChange={setSection} options={[{ value: 'fuel', label: t("Carburant") }, { value: 'payroll', label: t("Bulletins de paie") }]} />
    <Notice error={operation.error} message={operation.message} />
    {section === 'fuel' ? <>
      <Notice error={expenses.error} />
      {expenses.loading && !expenses.data && <Loading />}
      <Card><Text style={styles.heading}>{t("Déclarer un plein")}</Text>
        <Choices value={vehicleId} onChange={setVehicleId} disabled={operation.pending}
          options={(expenses.data?.vehicles ?? []).map(vehicle => ({ value: vehicle.id, label: `${vehicle.name} · ${vehicle.plate}` }))} />
        <Field label={t("Date locale (AAAA-MM-JJTHH:MM, Cambodge)")} value={occurredAt} onChangeText={setOccurredAt} maxLength={16} />
        <Field label={t("Compteur kilométrique (km)")} value={odometer} onChangeText={setOdometer} keyboardType="decimal-pad" maxLength={20} />
        <Field label={t("Litres")} value={liters} onChangeText={setLiters} keyboardType="decimal-pad" maxLength={20} />
        <Choices value={currency} onChange={setCurrency} options={[{ value: 'USD', label: 'USD' }, { value: 'KHR', label: 'KHR' }]} />
        <Field label={t("Montant ({p0})", { p0: currency })} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        {currency === 'KHR' && <Field label={t("Taux KHR pour 1 USD")} value={rate} onChangeText={setRate} keyboardType="decimal-pad" />}
        <View style={styles.row}><Text style={styles.label}>{t("Plein complet")}</Text><Switch accessibilityLabel={t("Plein complet")} value={fullTank} onValueChange={setFullTank} /></View>
        <Field label={t("Notes")} value={notes} onChangeText={setNotes} multiline maxLength={500} />
        <Button title={t("Transmettre la dépense")} disabled={operation.pending || !expenses.data} onPress={submit} />
      </Card>
      {expenses.data?.expenses.map(expense => <Card key={expense.id}>
        <Text style={styles.heading}>{expense.vehicle.name} · {expense.vehicle.plate}</Text>
        <Text style={styles.text}>{money(expense.amountCents, expense.currency)}</Text>
        <Text style={styles.muted}>{dateTime(expense.occurredAt)} · {expense.liters} {' '}{t("L ·")}{' '}{expense.odometerKm} {' '}{t("km")}</Text>
        <Text style={styles.badge}>{expense.status === 'PENDING' ? t("En attente") : expense.status === 'APPROVED' ? t("Approuvée") : expense.status === 'REJECTED' ? t("Refusée") : expense.status}</Text>
      </Card>)}
      {expenses.data && !expenses.data.expenses.length && <Text style={styles.muted}>{t("Aucune dépense enregistrée.")}</Text>}
    </> : <>
      <Notice error={payrolls.error} />
      {payrolls.loading && !payrolls.data && <Loading />}
      {payrolls.data?.payrolls.map(payroll => <Card key={payroll.id}>
        <Text style={styles.heading}>{t("Bulletin")}{' '}{payroll.month}</Text>
        <Text style={styles.badge}>{payroll.status === 'PAID' ? t("Payé") : t("Finalisé")}</Text>
        <Text style={styles.muted}>{t("Base :")}{' '}{money(payroll.baseSalaryCents)} {' '}{t("· Chiffre éligible :")}{' '}{money(payroll.eligibleRevenueCents)}</Text>
        <Text style={styles.text}>{t("Commission :")}{' '}{money(payroll.commissionCents)}</Text>
        <Text style={styles.muted}>{t("Prime :")}{' '}{money(payroll.bonusCents)} {' '}{t("· Retenue :")}{' '}{money(payroll.deductionCents)}</Text>
        <Text style={styles.price}>{money(payroll.netCents)}</Text>
        {payroll.paidAt && <Text style={styles.muted}>{t("Versé le")}{' '}{dateTime(payroll.paidAt)}</Text>}
        <Button title={t("Télécharger / partager le PDF")} secondary disabled={operation.pending}
          onPress={() => void operation.run(() => sharePdf(`/api/driver/payroll/${encodeURIComponent(payroll.id)}/pdf`, `saiway-paie-${payroll.month}`))} />
      </Card>)}
      {payrolls.data && !payrolls.data.payrolls.length && <Card><Text style={styles.muted}>{t("Aucun bulletin disponible.")}</Text></Card>}
    </>}
  </Page>;
}
