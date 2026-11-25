import { getIemResponse } from '../../../../lib/surface/iem-response';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return getIemResponse(new URL(req.url).searchParams);
}
