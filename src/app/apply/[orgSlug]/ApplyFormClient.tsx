"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import {
  buildDefaultResponses,
  buildResponseSchema,
  toResponseArray,
  yesNoOptions,
  type PublicOrgSummary,
  type PublicScreenerQuestion,
} from "@/server/domain/screener/publicForm";
import { volunteerProfileSchema } from "@/server/domain/volunteer-screening";

interface ApplyFormClientProps {
  org: PublicOrgSummary;
  questions: PublicScreenerQuestion[];
}

export function ApplyFormClient({ org, questions }: ApplyFormClientProps) {
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    county: "",
    availability: "",
    experienceLevel: "",
    notes: "",
  });
  const [responses, setResponses] = useState(() =>
    buildDefaultResponses(questions),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = trpc.screener.submit.useMutation();
  const responseSchema = useMemo(() => buildResponseSchema(questions), [questions]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    setFieldErrors({});

    const profileResult = volunteerProfileSchema.safeParse(profile);
    const responseResult = responseSchema.safeParse(responses);

    if (!profileResult.success || !responseResult.success) {
      const nextErrors: Record<string, string> = {};

      if (!profileResult.success) {
        for (const issue of profileResult.error.issues) {
          const key = String(issue.path[0] ?? "profile");
          nextErrors[key] = issue.message;
        }
      }

      if (!responseResult.success) {
        for (const issue of responseResult.error.issues) {
          const key = String(issue.path[0] ?? "responses");
          nextErrors[key] = issue.message;
        }
      }

      setFieldErrors(nextErrors);
      setSubmitError("Please correct the highlighted fields.");
      toast.error("Please fix the form errors and try again.");
      return;
    }

    try {
      await submitMutation.mutateAsync({
        orgId: org.id,
        submittedByEmail: profile.email,
        profile: profileResult.data,
        responses: toResponseArray(questions, responseResult.data),
      });
      setSubmitted(true);
    } catch (error) {
      setSubmitError("Something went wrong while submitting. Please try again.");
      toast.error("Unable to submit your application.");
    }
  };

  if (submitted) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-semibold">Thank you!</h2>
          <p className="text-sm text-muted-foreground">
            Your application has been received. {org.name} will be in touch.
          </p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Your details</h2>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="name">
              Full name
            </label>
            <Input
              id="name"
              value={profile.name}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, name: event.target.value }))
              }
            />
            {fieldErrors.name ? (
              <p className="text-xs text-destructive">{fieldErrors.name}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={profile.email}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, email: event.target.value }))
              }
            />
            {fieldErrors.email ? (
              <p className="text-xs text-destructive">{fieldErrors.email}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="phone">
              Phone
            </label>
            <Input
              id="phone"
              value={profile.phone}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, phone: event.target.value }))
              }
            />
            {fieldErrors.phone ? (
              <p className="text-xs text-destructive">{fieldErrors.phone}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="county">
              County
            </label>
            <Input
              id="county"
              value={profile.county}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, county: event.target.value }))
              }
            />
            {fieldErrors.county ? (
              <p className="text-xs text-destructive">{fieldErrors.county}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="availability">
              Availability
            </label>
            <Input
              id="availability"
              value={profile.availability}
              onChange={(event) =>
                setProfile((prev) => ({
                  ...prev,
                  availability: event.target.value,
                }))
              }
            />
            {fieldErrors.availability ? (
              <p className="text-xs text-destructive">{fieldErrors.availability}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="experienceLevel">
              Experience level
            </label>
            <Input
              id="experienceLevel"
              value={profile.experienceLevel}
              onChange={(event) =>
                setProfile((prev) => ({
                  ...prev,
                  experienceLevel: event.target.value,
                }))
              }
            />
            {fieldErrors.experienceLevel ? (
              <p className="text-xs text-destructive">
                {fieldErrors.experienceLevel}
              </p>
            ) : null}
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium" htmlFor="notes">
              Notes (optional)
            </label>
            <Input
              id="notes"
              value={profile.notes}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, notes: event.target.value }))
              }
            />
            {fieldErrors.notes ? (
              <p className="text-xs text-destructive">{fieldErrors.notes}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Screening questions</h2>
        </CardHeader>
        <CardContent className="space-y-6">
          {questions.map((question) => {
            const error = fieldErrors[question.id];
            const value = responses[question.id] ?? "";

            return (
              <div key={question.id} className="space-y-2">
                <label className="text-sm font-medium">
                  {question.prompt}
                </label>
                {question.type === "TEXT" ? (
                  <Input
                    value={value}
                    onChange={(event) =>
                      setResponses((prev) => ({
                        ...prev,
                        [question.id]: event.target.value,
                      }))
                    }
                  />
                ) : (
                  <Select
                    value={value}
                    onValueChange={(nextValue) =>
                      setResponses((prev) => ({
                        ...prev,
                        [question.id]: nextValue,
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {(question.type === "YES_NO"
                        ? yesNoOptions
                        : question.options ?? [])
                        .filter(Boolean)
                        .map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
                {error ? (
                  <p className="text-xs text-destructive">{error}</p>
                ) : null}
              </div>
            );
          })}

          {submitError ? (
            <p className="text-sm text-destructive">{submitError}</p>
          ) : null}

          <Button type="submit" disabled={submitMutation.isLoading}>
            {submitMutation.isLoading ? "Submitting..." : "Submit application"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
