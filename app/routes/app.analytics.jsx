import { useState } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  return { message: "Analytics page coming soon" };
};

export default function Analytics() {
  return (
    <s-page heading="Analytics Avanzado">
      <s-section>
        <s-card>
          <s-stack gap="base" alignment="center">
            <s-heading size="medium">📊 En Construcción</s-heading>
            <s-text>Esta sección estará disponible pronto</s-text>
            <s-text subdued>
              Aquí encontrarás reportes personalizables, exportaciones avanzadas y dashboards guardados.
            </s-text>
          </s-stack>
        </s-card>
      </s-section>
    </s-page>
  );
}