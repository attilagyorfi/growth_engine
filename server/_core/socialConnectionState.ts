/**
 * Kikapcsolt social kapcsolat: a hozzáférési kulcsok TÖRLŐDNEK, nem csak „inaktívak”.
 *
 * Élő teszt (2026-10-15): a Meta-engedélyezés után ~36 ügyfél-oldal és -Instagram
 * kulcsa maradt inaktív sorokban — a posztoláshoz nem kellettek, mégis tárolódtak.
 * Lecsatlakoztatáskor és újracsatlakozáskor (a régi kapcsolat cseréjénél) ezzel állítjuk be
 * a sort. (Az accessToken oszlop NOT NULL → üres szöveg.)
 */
export const DEACTIVATED_CONNECTION = { isActive: false, accessToken: "", refreshToken: null } as const;
