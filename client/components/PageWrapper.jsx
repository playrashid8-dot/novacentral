"use client";

import Loader from "./Loader";
import EmptyState from "./EmptyState";
import PageSkeleton from "./Skeleton";

/**
 * @param {{
 *   loading?: boolean;
 *   data?: unknown;
 *   skipEmpty?: boolean;
 *   emptyText?: string;
 *   useSkeletonLoading?: boolean;
 *   children: React.ReactNode;
 * }} props
 */
export default function PageWrapper({
  loading,
  data,
  skipEmpty = false,
  emptyText = "No data available",
  useSkeletonLoading = false,
  children,
}) {
  if (loading) {
    return useSkeletonLoading ? <PageSkeleton /> : <Loader />;
  }
  if (!skipEmpty && !data) {
    return <EmptyState text={emptyText} />;
  }
  return children;
}
