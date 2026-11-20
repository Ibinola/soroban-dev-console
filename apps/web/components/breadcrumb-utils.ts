export type BreadcrumbItem = {
  label: string;
  href: string;
  accessibleLabel?: string;
};

function truncateContractAddress(address: string) {
  return address.length > 10
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address;
}

export function getBreadcrumbItems(pathname: string): BreadcrumbItem[] | null {
  const home = { label: "Home", href: "/" };

  if (pathname === "/contracts") {
    return [home, { label: "Contracts", href: "/contracts" }];
  }
  if (pathname === "/contracts/graph") {
    return [
      home,
      { label: "Contracts", href: "/contracts" },
      { label: "Graph", href: "/contracts/graph" },
    ];
  }
  if (pathname.startsWith("/contracts/")) {
    const contractAddress = pathname.slice("/contracts/".length);
    if (contractAddress && !contractAddress.includes("/")) {
      return [
        home,
        { label: "Contracts", href: "/contracts" },
        {
          label: truncateContractAddress(contractAddress),
          accessibleLabel: contractAddress,
          href: pathname,
        },
      ];
    }
  }
  if (pathname === "/deploy") {
    return [home, { label: "Deploy", href: "/deploy" }];
  }
  if (pathname === "/deploy/wasm") {
    return [
      home,
      { label: "Deploy", href: "/deploy" },
      { label: "WASM Registry", href: "/deploy/wasm" },
    ];
  }
  if (pathname === "/tools/xdr") {
    return [
      home,
      { label: "Tools", href: "/tools/xdr" },
      { label: "XDR Decoder", href: "/tools/xdr" },
    ];
  }
  if (pathname === "/tools/ledger-keys") {
    return [
      home,
      { label: "Tools", href: "/tools/xdr" },
      { label: "Key Calculator", href: "/tools/ledger-keys" },
    ];
  }
  if (pathname === "/tx") {
    return [home, { label: "Transaction Lookup", href: "/tx" }];
  }
  if (pathname.startsWith("/tx/")) {
    const transactionHash = pathname.slice("/tx/".length);
    if (transactionHash && !transactionHash.includes("/")) {
      return [
        home,
        { label: "Transaction Lookup", href: "/tx" },
        { label: transactionHash, href: pathname },
      ];
    }
  }

  return null;
}
