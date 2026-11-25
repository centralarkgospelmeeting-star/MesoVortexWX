import { getNdbcResponse } from '../../../../lib/surface/ndbc-response';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return getNdbcResponse(new URL(req.url).searchParams, 'buoy');
}
