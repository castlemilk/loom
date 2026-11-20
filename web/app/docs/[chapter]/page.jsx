import { chapters } from '../../../docs/catalog'
import { Guide, metadataFor } from '../../../docs/guide'

export const dynamicParams = false
export function generateStaticParams() { return chapters.filter(c => c.slug).map(c => ({ chapter: c.slug })) }
export async function generateMetadata({ params }) { return metadataFor((await params).chapter) }
export default async function Page({ params }) { return <Guide slug={(await params).chapter} /> }
