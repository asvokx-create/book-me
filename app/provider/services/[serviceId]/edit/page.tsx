import ListingEditor from "./listing-editor";

export default async function EditListingPage({ params }: PageProps<"/provider/services/[serviceId]/edit">) {
  const { serviceId } = await params;
  return <ListingEditor serviceId={serviceId} />;
}
