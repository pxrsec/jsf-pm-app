import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  return [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      alternates: {
        languages: {
          "es-MX": `${baseUrl}/`,
          "en-US": `${baseUrl}/en/`,
        },
      },
    },
    {
      url: `${baseUrl}/en/`,
      lastModified: new Date(),
      alternates: {
        languages: {
          "es-MX": `${baseUrl}/`,
          "en-US": `${baseUrl}/en/`,
        },
      },
    },
    {
      url: `${baseUrl}/privacidad`,
      lastModified: new Date(),
      alternates: {
        languages: {
          "es-MX": `${baseUrl}/privacidad`,
          "en-US": `${baseUrl}/en/privacidad`,
        },
      },
    },
    {
      url: `${baseUrl}/en/privacidad`,
      lastModified: new Date(),
      alternates: {
        languages: {
          "es-MX": `${baseUrl}/privacidad`,
          "en-US": `${baseUrl}/en/privacidad`,
        },
      },
    },
    {
      url: `${baseUrl}/terminos`,
      lastModified: new Date(),
      alternates: {
        languages: {
          "es-MX": `${baseUrl}/terminos`,
          "en-US": `${baseUrl}/en/terminos`,
        },
      },
    },
    {
      url: `${baseUrl}/en/terminos`,
      lastModified: new Date(),
      alternates: {
        languages: {
          "es-MX": `${baseUrl}/terminos`,
          "en-US": `${baseUrl}/en/terminos`,
        },
      },
    },
  ];
}
