"use client"

import { useState, useTransition } from "react"
import { CheckCheck, Trash2, RotateCcw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { markDemoDone, markDemoPending, deleteDemoRequest } from "@/app/admin/actions"

interface Props {
  id: string
  status: string
}

export function DemoRequestActions({ id, status }: Props) {
  const [isPending, startTransition] = useTransition()
  const [action, setAction] = useState<string | null>(null)
  const isDone = status === "done"

  const handleDoneToggle = () => {
    setAction("done")
    startTransition(async () => {
      if (isDone) {
        await markDemoPending(id)
      } else {
        await markDemoDone(id)
      }
      setAction(null)
    })
  }

  const handleDelete = () => {
    setAction("delete")
    startTransition(async () => {
      await deleteDemoRequest(id)
      setAction(null)
    })
  }

  return (
    <div className="flex items-center gap-2 pt-1 border-t mt-2">
      <Button
        size="sm"
        variant={isDone ? "outline" : "default"}
        className={isDone ? "flex-1 text-muted-foreground" : "flex-1 bg-green-600 hover:bg-green-700 text-white"}
        onClick={handleDoneToggle}
        disabled={isPending}
      >
        {isPending && action === "done" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        ) : isDone ? (
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
        ) : (
          <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
        )}
        {isDone ? "Pending karo" : "Demo Done"}
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
            disabled={isPending}
          >
            {isPending && action === "delete" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request delete karein?</AlertDialogTitle>
            <AlertDialogDescription>
              Yeh demo request permanently delete ho jaayega. Isko wapas nahi laaya ja sakta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Haan, Delete karo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
