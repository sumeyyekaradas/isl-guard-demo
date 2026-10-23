export interface Well {
  id: string;
  type: 'enjeksiyon' | 'cekim' | 'izleme' | 'alici';
  x: number;
  y: number;
  base_rate: number;
  label?: string;
}

export const WELLS: Well[] = [
  { id: 'INJ-01', type: 'enjeksiyon', x: 500, y: 500, base_rate: 50.0, label: 'Enjeksiyon Kuyusu' },
  { id: 'EXT-01', type: 'cekim', x: 350, y: 350, base_rate: -12.5, label: 'Çekim Kuyusu 1' },
  { id: 'EXT-02', type: 'cekim', x: 650, y: 350, base_rate: -12.5, label: 'Çekim Kuyusu 2' },
  { id: 'EXT-03', type: 'cekim', x: 350, y: 650, base_rate: -12.5, label: 'Çekim Kuyusu 3' },
  { id: 'EXT-04', type: 'cekim', x: 650, y: 650, base_rate: -12.5, label: 'Çekim Kuyusu 4' },
  { id: 'MON-01', type: 'izleme', x: 750.0, y: 500.0, base_rate: 0.0, label: 'İzleme Kuyusu 1' },
  { id: 'MON-02', type: 'izleme', x: 716.5, y: 625.0, base_rate: 0.0, label: 'İzleme Kuyusu 2' },
  { id: 'MON-03', type: 'izleme', x: 625.0, y: 716.5, base_rate: 0.0, label: 'İzleme Kuyusu 3' },
  { id: 'MON-04', type: 'izleme', x: 500.0, y: 750.0, base_rate: 0.0, label: 'İzleme Kuyusu 4' },
  { id: 'MON-05', type: 'izleme', x: 375.0, y: 716.5, base_rate: 0.0, label: 'İzleme Kuyusu 5' },
  { id: 'MON-06', type: 'izleme', x: 283.5, y: 625.0, base_rate: 0.0, label: 'İzleme Kuyusu 6' },
  { id: 'MON-07', type: 'izleme', x: 250.0, y: 500.0, base_rate: 0.0, label: 'İzleme Kuyusu 7' },
  { id: 'MON-08', type: 'izleme', x: 283.5, y: 375.0, base_rate: 0.0, label: 'İzleme Kuyusu 8' },
  { id: 'MON-09', type: 'izleme', x: 375.0, y: 283.5, base_rate: 0.0, label: 'İzleme Kuyusu 9' },
  { id: 'MON-10', type: 'izleme', x: 500.0, y: 250.0, base_rate: 0.0, label: 'İzleme Kuyusu 10' },
  { id: 'MON-11', type: 'izleme', x: 625.0, y: 283.5, base_rate: 0.0, label: 'İzleme Kuyusu 11' },
  { id: 'MON-12', type: 'izleme', x: 716.5, y: 375.0, base_rate: 0.0, label: 'İzleme Kuyusu 12' },
  { id: 'RCV-01', type: 'alici', x: 150, y: 150, base_rate: 0.0, label: 'Alıcı / Çevre Kuyusu 1' },
  { id: 'RCV-02', type: 'alici', x: 850, y: 150, base_rate: 0.0, label: 'Alıcı / Çevre Kuyusu 2' },
  { id: 'RCV-03', type: 'alici', x: 500, y: 900, base_rate: 0.0, label: 'Alıcı / Çevre Kuyusu 3' },
];
